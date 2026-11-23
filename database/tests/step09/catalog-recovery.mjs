// Exact-state repair of the observed disposable 000019 verifier-only failure.
// Never changes application artifacts, original checksums or FAILED history.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { migrationChecksum, verifyCatalog, withMigrationLock } from '@sportify/migrations';
import { assertTestOwner } from './fixtures.mjs';

export function caseCatalogRepairManifest(base) {
  assert.equal(base.migrations.length, 26);
  assert.equal(base.migrations[18].version, '000019');
  assert.equal(base.migrations[18].name, 'subscription_terms');
  const path =
    'migrations/000027_reconcile_subscription_case_catalog/001_catalog_reconciliation.sql';
  const statements = [{ path, sql: 'BEGIN NULL; END;\n' }];
  const metadata = {
    version: '000027',
    name: 'reconcile_subscription_case_catalog',
    kind: 'schema',
    repairOf: '000019',
    files: [{ path, format: 'plsql' }],
    tables: [],
    constraints: [],
    indexes: [],
    seeds: [],
  };
  const repair = { ...metadata, statements, checksum: migrationChecksum(metadata, statements) };
  return { manifest: { ...base, migrations: [...base.migrations, repair] }, repair };
}
export async function reconcileCaseCatalogFailure(session, owner, base) {
  assertTestOwner(owner);
  const { manifest, repair } = caseCatalogRepairManifest(base);
  await withMigrationLock(session, owner, async () => {
    const query = async (sql) => (await session.execute(sql, {}, { outFormat: 4002 })).rows ?? [];
    const history = await query(
      'SELECT VERSION,CHECKSUM,EXECUTION_STATUS,REPAIR_VERSION FROM SCHEMA_MIGRATIONS ORDER BY VERSION',
    );
    const original = base.migrations.slice(0, 19).map((entry, index) => ({
      VERSION: entry.version,
      CHECKSUM: entry.checksum,
      EXECUTION_STATUS: index === 18 ? 'FAILED' : 'APPLIED',
      REPAIR_VERSION: null,
    }));
    const linkedPrefix = original.map((row) => ({
      ...row,
      REPAIR_VERSION: row.VERSION === '000019' ? repair.version : null,
    }));
    const repairRow = {
      VERSION: repair.version,
      CHECKSUM: repair.checksum,
      EXECUTION_STATUS: 'APPLIED',
      REPAIR_VERSION: null,
    };
    const recoveredPrefix = [...linkedPrefix, repairRow];
    const recoveredFull = [
      ...base.migrations.map((entry, index) => ({
        VERSION: entry.version,
        CHECKSUM: entry.checksum,
        EXECUTION_STATUS: index === 18 ? 'FAILED' : 'APPLIED',
        REPAIR_VERSION: index === 18 ? repair.version : null,
      })),
      repairRow,
    ];
    const same = (expected) => JSON.stringify(history) === JSON.stringify(expected);
    const initial = same(original),
      prefix = same(recoveredPrefix),
      full = same(recoveredFull);
    assert.ok(
      initial || prefix || full,
      'Only the exact observed 18-APPLIED/000019-FAILED state, its linked prefix, or the completely installed linked release is supported.',
    );
    const installed = base.migrations.slice(0, full ? 26 : 19);
    // A corrected verifier must prove the complete original catalog first.
    // Unknown/partial DDL, changed checksums, unexpected history or data refuse.
    await verifyCatalog(session, installed, owner);
    for (const table of installed.flatMap((entry) => entry.tables)) {
      if (['SCHEMA_MIGRATIONS', 'SPORTS', 'PERMISSIONS'].includes(table.name)) continue;
      assert.equal(
        (await query(`SELECT COUNT(*) AS TOTAL FROM ${table.name}`))[0]?.TOTAL,
        0,
        'No residual business/fixture rows may be adopted.',
      );
    }
    if (!initial) return;
    const started = performance.now();
    await session.execute(
      "INSERT INTO SCHEMA_MIGRATIONS(VERSION,DESCRIPTION,CHECKSUM,RUNNER_ID,EXECUTION_STATUS) VALUES(:p_version,:p_name,:p_checksum,:p_runner,'RUNNING')",
      {
        p_version: repair.version,
        p_name: repair.name,
        p_checksum: repair.checksum,
        p_runner: randomUUID(),
      },
      { autoCommit: false },
    );
    await session.commit();
    await session.execute(repair.statements[0].sql, {}, { autoCommit: false });
    await verifyCatalog(session, installed, owner);
    const applied = await session.execute(
      "UPDATE SCHEMA_MIGRATIONS SET EXECUTION_STATUS='APPLIED',INSTALLED_AT_UTC=LOCALTIMESTAMP,FINISHED_AT_UTC=LOCALTIMESTAMP,EXECUTION_MS=:p_elapsed WHERE VERSION=:p_version AND EXECUTION_STATUS='RUNNING'",
      { p_version: repair.version, p_elapsed: Math.floor(performance.now() - started) },
      { autoCommit: false },
    );
    assert.equal(applied.rowsAffected, 1);
    const linked = await session.execute(
      "UPDATE SCHEMA_MIGRATIONS SET REPAIR_VERSION=:p_repair WHERE VERSION='000019' AND CHECKSUM=:p_checksum AND EXECUTION_STATUS='FAILED' AND REPAIR_VERSION IS NULL",
      { p_repair: repair.version, p_checksum: base.migrations[18].checksum },
      { autoCommit: false },
    );
    assert.equal(linked.rowsAffected, 1);
    // Retain FAILED 000019, linking it atomically to the verified APPLIED repair.
    await session.commit();
  });
  return manifest;
}
