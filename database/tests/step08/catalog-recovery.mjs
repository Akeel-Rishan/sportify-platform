// Explicit repair of the observed disposable 000017 verifier-only failure.
// No application manifest/DDL, schema clearing or automatic failure adoption.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { migrationChecksum, verifyCatalog, withMigrationLock } from '@sportify/migrations';
import { assertTestOwner } from './fixtures.mjs';

export function caseCatalogRepairManifest(base) {
  assert.equal(base.migrations.length, 17);
  assert.equal(base.migrations[16].version, '000017');
  assert.equal(base.migrations[16].name, 'venue_receipts_and_refunds');
  const path = 'migrations/000018_reconcile_case_catalog/001_catalog_reconciliation.sql';
  const statements = [{ path, sql: 'BEGIN NULL; END;\n' }];
  const metadata = {
    version: '000018',
    name: 'reconcile_case_catalog',
    kind: 'schema',
    repairOf: '000017',
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
    const expected = base.migrations.map((entry, index) => ({
      VERSION: entry.version,
      CHECKSUM: entry.checksum,
      EXECUTION_STATUS: index === 16 ? 'FAILED' : 'APPLIED',
      REPAIR_VERSION: null,
    }));
    const repaired = expected.map((row) => ({
      ...row,
      REPAIR_VERSION: row.VERSION === '000017' ? repair.version : null,
    }));
    repaired.push({
      VERSION: repair.version,
      CHECKSUM: repair.checksum,
      EXECUTION_STATUS: 'APPLIED',
      REPAIR_VERSION: null,
    });
    const alreadyRepaired = history.length === 18;
    assert.deepEqual(
      history,
      alreadyRepaired ? repaired : expected,
      'Exact observed CASE-verifier failure or its linked repair required.',
    );
    // Verify every original object, including both valid finance indexes, before
    // recording any recovery. Unknown/partial DDL fails closed.
    await verifyCatalog(session, base.migrations, owner);
    for (const table of base.migrations.flatMap((entry) => entry.tables)) {
      if (['SCHEMA_MIGRATIONS', 'SPORTS', 'PERMISSIONS'].includes(table.name)) continue;
      assert.equal(
        (await query(`SELECT COUNT(*) AS TOTAL FROM ${table.name}`))[0]?.TOTAL,
        0,
        'No residual business/fixture rows may be adopted.',
      );
    }
    if (alreadyRepaired) return;
    const started = performance.now();
    await session.execute(
      "INSERT INTO SCHEMA_MIGRATIONS(VERSION,DESCRIPTION,CHECKSUM,RUNNER_ID,EXECUTION_STATUS) VALUES(:version,:name,:checksum,:runner,'RUNNING')",
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
    await verifyCatalog(session, manifest.migrations, owner);
    const applied = await session.execute(
      "UPDATE SCHEMA_MIGRATIONS SET EXECUTION_STATUS='APPLIED',INSTALLED_AT_UTC=LOCALTIMESTAMP,FINISHED_AT_UTC=LOCALTIMESTAMP,EXECUTION_MS=:elapsed WHERE VERSION=:version AND EXECUTION_STATUS='RUNNING'",
      { version: repair.version, elapsed: Math.floor(performance.now() - started) },
      { autoCommit: false },
    );
    assert.equal(applied.rowsAffected, 1);
    const linked = await session.execute(
      "UPDATE SCHEMA_MIGRATIONS SET REPAIR_VERSION=:repair WHERE VERSION='000017' AND CHECKSUM=:checksum AND EXECUTION_STATUS='FAILED' AND REPAIR_VERSION IS NULL",
      { repair: repair.version, checksum: base.migrations[16].checksum },
      { autoCommit: false },
    );
    assert.equal(linked.rowsAffected, 1);
    // The APPLIED repair and retained FAILED linkage commit atomically.
    await session.commit();
  });
  return manifest;
}
