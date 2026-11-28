// Explicit operator-only integration suite. No application/ordinary CI imports.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { EnvironmentError } from '@sportify/validation';
import {
  loadManifest,
  assertReady,
  parseMigrationConfig,
  withOwnerSession,
  migrateSession,
  verifySession,
  statusSession,
  migrationChecksum,
  MigrationError,
} from '@sportify/migrations';
import {
  runtimeVerificationConfigs,
  verifyRuntimePrivileges,
} from './support/runtime-privileges.mjs';
import { TEST_OWNER, createFixtures, cleanupFixtures } from './step09/fixtures.mjs';
import { verifyIntegrity } from './step09/integrity.mjs';
import { verifyTransactions } from './step09/transactions.mjs';
import { reconcileCaseCatalogFailure } from './step09/catalog-recovery.mjs';

let phase = 'prerequisites';
try {
  const reconcile = process.argv[2] === '--reconcile-case-catalog';
  assert.equal(
    process.argv.length,
    reconcile ? 3 : 2,
    'Only the specific observed CASE-catalog recovery flag is supported.',
  );
  const release = await loadManifest(fileURLToPath(new URL('../', import.meta.url)));
  let manifest = { ...release, migrations: release.migrations.slice(0, 26) };
  assertReady(manifest); // Before reading credentials or opening any connection.
  assert.equal(manifest.migrations.length, 26);
  const config = parseMigrationConfig(process.env);
  assert.equal(config.ORACLE_MIGRATION_SCHEMA, TEST_OWNER);
  assert.equal(process.env.ORACLE_MIGRATION_TEST_CONFIRM, 'isolated-disposable-empty');
  const runtimes = runtimeVerificationConfigs(process.env);
  await withOwnerSession(config, async (session) => {
    const query = async (sql) => (await session.execute(sql, {}, { outFormat: 4002 })).rows ?? [];
    if (!reconcile)
      assert.equal(
        (await query('SELECT OBJECT_NAME FROM USER_OBJECTS')).length,
        0,
        'A genuinely new, empty Step 09 disposable schema is required. Never reset an old owner.',
      );
    assert.deepEqual(
      await query('SELECT PRIVILEGE,ADMIN_OPTION FROM USER_SYS_PRIVS ORDER BY PRIVILEGE'),
      [
        { PRIVILEGE: 'CREATE SEQUENCE', ADMIN_OPTION: 'NO' },
        { PRIVILEGE: 'CREATE SESSION', ADMIN_OPTION: 'NO' },
        { PRIVILEGE: 'CREATE TABLE', ADMIN_OPTION: 'NO' },
      ],
    );
    assert.equal((await query('SELECT GRANTED_ROLE FROM USER_ROLE_PRIVS')).length, 0);
    assert.deepEqual(
      await query(
        'SELECT OWNER,TABLE_NAME,PRIVILEGE,GRANTABLE FROM USER_TAB_PRIVS WHERE GRANTEE=USER',
      ),
      [{ OWNER: 'SYS', TABLE_NAME: 'DBMS_LOCK', PRIVILEGE: 'EXECUTE', GRANTABLE: 'NO' }],
    );
    assert.equal((await query('SELECT GRANTEE FROM USER_COL_PRIVS WHERE GRANTEE=USER')).length, 0);
    assert.deepEqual(
      await query('SELECT TABLESPACE_NAME,MAX_BYTES FROM USER_TS_QUOTAS WHERE MAX_BYTES<>0'),
      [{ TABLESPACE_NAME: 'DATA', MAX_BYTES: 268435456 }],
    );
    phase = 'migrations';
    if (reconcile) {
      phase = 'case-catalog-reconciliation';
      manifest = await reconcileCaseCatalogFailure(session, TEST_OWNER, manifest);
      phase = 'resumed-migrations';
    }
    const pending = (await statusSession(session, manifest)).pending.length;
    assert.equal(
      (await migrateSession(session, TEST_OWNER, manifest)).length,
      reconcile ? pending : 26,
    );
    assert.deepEqual(await migrateSession(session, TEST_OWNER, manifest), []);
    await verifySession(session, TEST_OWNER, manifest);
    const before = await statusSession(session, manifest),
      changed = structuredClone(manifest);
    changed.migrations[0].name += '_tampered';
    changed.migrations[0].checksum = migrationChecksum(
      changed.migrations[0],
      changed.migrations[0].statements,
    );
    await assert.rejects(
      migrateSession(session, TEST_OWNER, changed),
      (error) => error instanceof MigrationError && error.code === 'ARTIFACT_CHANGED',
    );
    assert.equal((await statusSession(session, manifest)).history.length, before.history.length);
    let fixtures,
      failed = false,
      cleanupFailed = false;
    try {
      phase = 'fixtures';
      fixtures = await createFixtures(session, TEST_OWNER, manifest);
      phase = 'integrity';
      await verifyIntegrity(session, TEST_OWNER, fixtures);
      phase = 'transactions';
      await verifyTransactions(config, session, manifest, fixtures);
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      try {
        await session.rollback();
        if (fixtures) await cleanupFixtures(session, TEST_OWNER, manifest, fixtures);
      } catch {
        cleanupFailed = true;
        console.error('Step 09 cleanup failed; retained disposable state requires inspection.');
      }
    }
    if (cleanupFailed && !failed) throw new Error('Fixture cleanup failed.');
    phase = 'postconditions';
    await verifySession(session, TEST_OWNER, manifest);
    for (const table of manifest.migrations
      .flatMap((entry) => entry.tables)
      .filter((table) => !['SCHEMA_MIGRATIONS', 'SPORTS', 'PERMISSIONS'].includes(table.name)))
      assert.equal(
        (await query(`SELECT COUNT(*) AS TOTAL FROM ${table.name}`))[0]?.TOTAL,
        0,
        'Only reference rows/history may remain.',
      );
    phase = 'privileges';
    await verifyRuntimePrivileges(runtimes, config.ORACLE_MIGRATION_DB_UNIQUE_NAME, TEST_OWNER);
  });
  console.info(
    reconcile
      ? 'PASS real Oracle Step 09 exact CASE-catalog recovery, remaining apply, repeat/catalog/seeds/checksum refusal, integrity, transaction/concurrency and runtime denials. FAILED 000019 retained and linked to test-only 000027; fixture rows removed.'
      : 'PASS real Oracle Step 09 fresh apply, repeat/no-op, full catalog/seed verification, checksum refusal, integrity, transaction/concurrency harnesses and runtime denials. Fixture rows removed; reference/history retained.',
  );
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'step09.oracle.failed',
      phase,
      requirements:
        'Approved manifest, exact fresh SPORTIFY_STEP09_TEST_OWNER, designated development target, private owner/runtime credentials and isolated-disposable-empty confirmation required.',
      code:
        error instanceof MigrationError
          ? error.code
          : error instanceof EnvironmentError
            ? 'CONFIGURATION_REQUIRED'
            : 'ASSERTION_OR_PREREQUISITE_FAILED',
    }),
  );
  process.exitCode = 1;
}
