// Explicit operator-only real Oracle suite; never imported by applications/CI.
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
import { TEST_OWNER, createFixtures, cleanupFixtures } from './step08/fixtures.mjs';
import { verifyIntegrity } from './step08/integrity.mjs';
import { verifyConcurrency } from './step08/concurrency.mjs';
import { reconcileCaseCatalogFailure } from './step08/catalog-recovery.mjs';

let phase = 'prerequisites';
try {
  const reconcile = process.argv[2] === '--reconcile-case-catalog';
  assert.equal(process.argv.length, reconcile ? 3 : 2);
  const release = await loadManifest(fileURLToPath(new URL('../', import.meta.url)));
  assertReady(release);
  let manifest = { ...release, migrations: release.migrations.slice(0, 17) };
  assert.equal(manifest.migrations.length, 17);
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
        'Only a genuinely new disposable owner may run this suite.',
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
    assert.equal((await migrateSession(session, TEST_OWNER, manifest)).length, reconcile ? 0 : 17);
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
    console.info(
      reconcile
        ? 'PASS actual Step 08 exact-state CASE catalog reconciliation; FAILED 000017 retained and linked to test-only 000018. Repeat/catalog/checksum refusal passed; original SQL unchanged.'
        : 'PASS actual Step 08 clean ordered apply/repeat/catalog/checksum refusal; original Step 07 definitions included intact.',
    );
    let fixtures,
      failed = false,
      cleanupError;
    try {
      phase = 'fixtures';
      fixtures = await createFixtures(session, TEST_OWNER, manifest);
      phase = 'integrity';
      await verifyIntegrity(session, TEST_OWNER, manifest, fixtures);
      phase = 'concurrency';
      await verifyConcurrency(config, session, fixtures);
      phase = 'precision';
      const precise = (
        await session.execute(
          "SELECT TO_CHAR(TO_NUMBER(:amount,'9999999990D99','NLS_NUMERIC_CHARACTERS=''.,'''),'FM9999999990D00','NLS_NUMERIC_CHARACTERS=''.,''') AS AMOUNT FROM DUAL",
          { amount: '9999999999.99' },
          { outFormat: 4002 },
        )
      ).rows?.[0]?.AMOUNT;
      assert.equal(precise, '9999999999.99');
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      try {
        await session.rollback();
        if (fixtures) await cleanupFixtures(session, TEST_OWNER, manifest, fixtures);
      } catch (error) {
        cleanupError = error;
        console.error(
          'Step 08 fixture cleanup failed; retained disposable state requires inspection.',
        );
      }
    }
    if (cleanupError && !failed) throw new Error('Fixture cleanup failed.');
    phase = 'postconditions';
    await verifySession(session, TEST_OWNER, manifest);
    for (const table of [
      'TENANTS',
      'USERS',
      'CUSTOMERS',
      'BOOKINGS',
      'BOOKING_HOLDS',
      'RESOURCE_SLOT_RESERVATIONS',
      'PAYMENTS',
      'REFUNDS',
    ])
      assert.equal(
        (await query(`SELECT COUNT(*) AS TOTAL FROM ${table}`))[0]?.TOTAL,
        0,
        'Only reference rows/history may remain.',
      );
    phase = 'privileges';
    await verifyRuntimePrivileges(runtimes, config.ORACLE_MIGRATION_DB_UNIQUE_NAME, TEST_OWNER);
  });
  console.info(
    'PASS real Oracle Step 08 migration/integrity/A-E concurrency suite; known fixture records removed, schema/reference/history retained, connections closed. Production booking/payment/cleanup services are not implemented.',
  );
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'step08.oracle.failed',
      requirements:
        'Approved manifest, known development target, exact fresh SPORTIFY_STEP08_TEST_OWNER, private owner/runtime credentials and isolated-disposable-empty marker are required.',
      phase,
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
