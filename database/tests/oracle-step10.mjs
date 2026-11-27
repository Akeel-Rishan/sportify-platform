// Explicit operator suite. Runtime-only and read-only modes never mutate schema.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import oracledb from 'oracledb';
import { EnvironmentError } from '@sportify/validation';
import {
  assertReady,
  loadManifest,
  MigrationError,
  migrateSession,
  parseMigrationConfig,
  statusSession,
  verifyCatalog,
  verifySession,
  withOwnerSession,
} from '@sportify/migrations';
import { verifyIntegrity as verifyCore } from './support/integrity.mjs';
import { verifyRuntimePrivileges } from './support/runtime-privileges.mjs';
import { createFixtures, cleanupFixtures } from './step09/fixtures.mjs';
import { verifyIntegrity as verifyOperations } from './step09/integrity.mjs';
import { verifyTransactions } from './step09/transactions.mjs';
import { verifyIntegrity as verifyReservations } from './step08/integrity.mjs';
import { verifyConcurrency } from './step08/concurrency.mjs';
import {
  CLEAN_OWNER,
  TARGET,
  safeFailure,
  step10Configuration,
  verifyEmptyOwner,
  UPGRADE_OWNER,
} from './step10/config.mjs';
import { verifyConnectionLifecycle } from './step10/connection-lifecycle.mjs';
import { verifyApplicationLifecycle, verifyEntrypoint } from './step10/application-lifecycle.mjs';
import { verifyApplicationPrivileges } from './step10/application-privileges.mjs';
import { verifyRuntimeTransactions } from './step10/runtime-transactions.mjs';
import { verifyTenantRelationships } from './step10/tenant-relationships.mjs';
import {
  verifyEmptyBaseline,
  verifyCleanInstall,
  verifyInstalledCleanOwner,
  verifyUpgrade,
  verifyRunnerLock,
  verifyInjectedFailures,
  snapshotFixtures,
} from './step10/migrations.mjs';

function record(check, result, details = {}) {
  console.info(JSON.stringify({ event: 'step10.verification', check, result, ...details }));
}

async function baseline(manifest, environment) {
  const config = parseMigrationConfig(environment);
  assert.equal(config.ORACLE_MIGRATION_SCHEMA, 'SPORTIFY_SCHEMA_OWNER');
  assert.equal(config.ORACLE_MIGRATION_DB_UNIQUE_NAME, TARGET);
  await withOwnerSession(config, async (session) => {
    const status = await statusSession(session, manifest);
    assert.equal(status.history.length, 26);
    assert.deepEqual(status.pending, []);
    assert.ok(
      status.history.every(
        (row) => row.EXECUTION_STATUS === 'APPLIED' && row.REPAIR_VERSION === null,
      ),
    );
    await verifyCatalog(session, manifest.migrations, config.ORACLE_MIGRATION_SCHEMA);
    const owners = (
      await session.execute(
        'SELECT USERNAME FROM ALL_USERS WHERE USERNAME IN (:clean,:upgrade) ORDER BY USERNAME',
        { clean: CLEAN_OWNER, upgrade: UPGRADE_OWNER },
      )
    ).rows.map(([owner]) => owner);
    const counts = (
      await session.execute(
        'SELECT (SELECT COUNT(*) FROM SPORTS), (SELECT COUNT(*) FROM PERMISSIONS), (SELECT COUNT(*) FROM SUBSCRIPTION_PLANS), (SELECT COUNT(*) FROM WEBSITE_THEMES) FROM DUAL',
      )
    ).rows[0];
    assert.deepEqual(counts, [8, 20, 0, 0]);
    record('application.read-only-catalog', 'PASS', {
      versions: status.history.length,
      databaseVersion: session.oracleServerVersionString,
      driverVersion: oracledb.versionString,
      thin: oracledb.thin,
      node: process.version,
      disposableAccountsPresent: owners,
      sports: counts[0],
      permissions: counts[1],
    });
  });
}

async function businessHarnesses(session, config, manifest) {
  const fixtures = await createFixtures(session, CLEAN_OWNER, manifest, {
    expectedOwner: CLEAN_OWNER,
  });
  let failed = false;
  try {
    await verifyReservations(session, CLEAN_OWNER, manifest, fixtures);
    await verifyConcurrency(config, session, fixtures);
    await verifyOperations(session, CLEAN_OWNER, fixtures);
    await verifyTransactions(config, session, manifest, fixtures);
    const data = await snapshotFixtures(session, manifest);
    const before = await statusSession(session, manifest);
    assert.deepEqual(await migrateSession(session, CLEAN_OWNER, manifest, () => {}), []);
    assert.deepEqual(await statusSession(session, manifest), before);
    assert.deepEqual(await snapshotFixtures(session, manifest), data);
    record('migration.clean-repeat-data-preservation', 'PASS');
    record('reservations.financial-and-operations', 'PASS');
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    await session
      .rollback()
      .then(() => cleanupFixtures(session, CLEAN_OWNER, manifest, fixtures))
      .catch((error) => {
        record('business.fixture-cleanup', 'FAIL');
        if (!failed) throw error;
      });
  }
  for (const table of manifest.migrations.flatMap((entry) => entry.tables)) {
    if (['SCHEMA_MIGRATIONS', 'SPORTS', 'PERMISSIONS'].includes(table.name)) continue;
    assert.deepEqual((await session.execute(`SELECT COUNT(*) FROM ${table.name}`)).rows, [[0]]);
  }
}

let phase = 'prerequisites';
try {
  const option = process.argv[2];
  assert.ok(
    [
      undefined,
      '--baseline',
      '--lifecycle',
      '--apps',
      '--console-api',
      '--console-worker',
      '--continue-after-clean-install',
    ].includes(option) && process.argv.length <= 3,
  );
  const manifest = await loadManifest(fileURLToPath(new URL('../', import.meta.url)));
  assertReady(manifest);
  assert.equal(manifest.migrations.length, 26);
  if (option === '--baseline') {
    phase = 'application-read-only';
    await baseline(manifest, process.env);
  } else if (option === '--console-api' || option === '--console-worker') {
    assert.ok(process.stdin.isTTY, 'An interactive console is required.');
    const { runtimes } = step10Configuration(process.env, { owners: false });
    phase = 'native-console-signal';
    await verifyEntrypoint(runtimes[option === '--console-api' ? 0 : 1], record, {
      consoleSignal: true,
    });
  } else {
    const installed = option === '--continue-after-clean-install';
    const complete = option === undefined || installed;
    const { clean, upgrade, runtimes } = step10Configuration(process.env, {
      owners: complete,
    });
    process.env.TZ = 'Asia/Colombo';
    const application = complete
      ? parseEnv(await readFile(new URL('../provisioning/migrations.env', import.meta.url), 'utf8'))
      : undefined;
    if (complete) {
      phase = 'application-read-only';
      await baseline(manifest, application);
      phase = 'preflight-both-disposable-owners';
      await withOwnerSession(upgrade, (session) => verifyEmptyOwner(session, UPGRADE_OWNER));
      await withOwnerSession(clean, (session) =>
        installed
          ? verifyInstalledCleanOwner(session, manifest)
          : verifyEmptyOwner(session, CLEAN_OWNER),
      );
    }
    if (option !== '--apps') {
      phase = 'connection-lifecycle';
      await verifyConnectionLifecycle(runtimes, record);
      phase = 'application-runtime-privileges';
      await verifyApplicationPrivileges(runtimes, record);
    }
    phase = 'compiled-application-lifecycle';
    await verifyApplicationLifecycle(runtimes, record);
    if (complete) {
      if (!installed) {
        phase = 'unknown-populated-owner';
        await verifyEmptyBaseline(clean, manifest, record);
      }
      await withOwnerSession(clean, async (session) => {
        phase = 'clean-migrations-and-seeds';
        await verifyCleanInstall(session, manifest, record, { installed });
        phase = 'tenant-relationships';
        await verifyTenantRelationships(session, manifest, record);
        phase = 'core-constraints';
        await verifyCore(session, CLEAN_OWNER, manifest);
        phase = 'reservations-and-operations';
        await businessHarnesses(session, clean, manifest);
        phase = 'runtime-transactions';
        await verifyRuntimeTransactions(session, runtimes, record);
        phase = 'runtime-privileges';
        await verifyRuntimePrivileges(runtimes, TARGET, CLEAN_OWNER);
        phase = 'concurrent-runner-lock';
        await verifyRunnerLock(clean, session, manifest, record);
        await verifySession(session, CLEAN_OWNER, manifest);
      });
      phase = 'upgrade';
      await withOwnerSession(upgrade, (session) => verifyUpgrade(session, manifest, record));
      phase = 'failure-injection';
      await withOwnerSession(clean, async (session) => {
        await verifySession(session, CLEAN_OWNER, manifest);
        await verifyInjectedFailures(session, manifest, record);
      });
      phase = 'application-final-read-only';
      await baseline(manifest, application);
    }
  }
  record(option ?? 'foundation-suite', 'PASS');
} catch (error) {
  record(phase, phase === 'prerequisites' ? 'BLOCKED' : 'FAIL', {
    ...safeFailure(error),
    ...(error instanceof MigrationError ? { migration: error.code } : {}),
    ...(error instanceof EnvironmentError ? { configuration: error.message } : {}),
  });
  if (phase === 'prerequisites')
    console.error(
      'Step 10 requires the protected configuration and exact disposable owners. See Docs/database/step10-operator-setup.md.',
    );
  process.exitCode = 1;
}
