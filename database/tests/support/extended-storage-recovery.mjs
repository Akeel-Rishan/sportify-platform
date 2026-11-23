// One explicit disposable-owner reconciliation for the first real catalog run.
// Never imported by applications or registered in the application manifest.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { migrationChecksum, verifyCatalog, withMigrationLock } from '@sportify/migrations';

export function extendedStorageRepairManifest(base) {
  assert.equal(base.migrations.length, 11);
  assert.equal(base.migrations[7].version, '000008');
  assert.equal(base.migrations[7].name, 'resources');
  const path =
    'migrations/000012_reconcile_extended_varchar_storage/001_catalog_reconciliation.sql';
  const statements = [{ path, sql: 'BEGIN NULL; END;\n' }];
  const metadata = {
    version: '000012',
    name: 'reconcile_extended_varchar_storage',
    kind: 'schema',
    repairOf: '000008',
    files: [{ path, format: 'plsql' }],
    tables: [],
    constraints: [],
    indexes: [],
    seeds: [],
  };
  const repair = { ...metadata, statements, checksum: migrationChecksum(metadata, statements) };
  return { manifest: { ...base, migrations: [...base.migrations, repair] }, repair };
}

export async function reconcileExtendedStorageFailure(session, owner, base) {
  assert.equal(owner, 'SPORTIFY_TEST_OWNER');
  const { manifest, repair } = extendedStorageRepairManifest(base);
  await withMigrationLock(session, owner, async () => {
    const started = performance.now();
    const result = await session.execute(
      'SELECT VERSION,CHECKSUM,EXECUTION_STATUS,REPAIR_VERSION FROM SCHEMA_MIGRATIONS ORDER BY VERSION',
      {},
      { outFormat: 4002 },
    );
    assert.deepEqual(
      result.rows,
      base.migrations.slice(0, 8).map((entry, index) => ({
        VERSION: entry.version,
        CHECKSUM: entry.checksum,
        EXECUTION_STATUS: index === 7 ? 'FAILED' : 'APPLIED',
        REPAIR_VERSION: null,
      })),
      'Exact unreconciled first-run state required; no automatic adoption or retry.',
    );
    // All original DDL succeeded. The corrected verifier must prove the exact
    // full catalog through 000008 before touching retained failure history.
    await verifyCatalog(session, base.migrations.slice(0, 8), owner);
    await session.execute(
      "INSERT INTO SCHEMA_MIGRATIONS (VERSION,DESCRIPTION,CHECKSUM,RUNNER_ID,EXECUTION_STATUS) VALUES (:version,:name,:checksum,:runner,'RUNNING')",
      {
        version: repair.version,
        name: repair.name,
        checksum: repair.checksum,
        runner: randomUUID(),
      },
      { autoCommit: false },
    );
    await session.commit();
    await session.execute(repair.statements[0].sql, {}, { autoCommit: false });
    await verifyCatalog(session, [...base.migrations.slice(0, 8), repair], owner);
    const applied = await session.execute(
      "UPDATE SCHEMA_MIGRATIONS SET EXECUTION_STATUS='APPLIED',INSTALLED_AT_UTC=LOCALTIMESTAMP,FINISHED_AT_UTC=LOCALTIMESTAMP,EXECUTION_MS=:elapsed WHERE VERSION=:version AND EXECUTION_STATUS='RUNNING'",
      { version: repair.version, elapsed: Math.floor(performance.now() - started) },
      { autoCommit: false },
    );
    assert.equal(applied.rowsAffected, 1);
    await session.commit();
    const linked = await session.execute(
      "UPDATE SCHEMA_MIGRATIONS SET REPAIR_VERSION=:repair WHERE VERSION='000008' AND CHECKSUM=:checksum AND EXECUTION_STATUS='FAILED' AND REPAIR_VERSION IS NULL",
      { repair: repair.version, checksum: base.migrations[7].checksum },
      { autoCommit: false },
    );
    assert.equal(linked.rowsAffected, 1);
    await session.commit();
  });
  return manifest;
}
