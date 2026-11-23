import { describe, it, expect, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadManifest } from '@sportify/migrations';
import {
  caseCatalogRepairManifest,
  reconcileCaseCatalogFailure,
} from '../step08/catalog-recovery.mjs';
async function baseline() {
  const release = await loadManifest(fileURLToPath(new URL('../../', import.meta.url)));
  return { ...release, migrations: release.migrations.slice(0, 17) };
}
describe('Step 08 explicit catalog repair (unit only)', () => {
  it('preserves all source entries and appends only deterministic isolated repair metadata', async () => {
    const base = await baseline();
    const { manifest, repair } = caseCatalogRepairManifest(base);
    expect(manifest.migrations.slice(0, 17)).toEqual(base.migrations);
    expect(repair.repairOf).toBe('000017');
    expect(repair.version).toBe('000018');
    expect(repair.tables).toEqual([]);
    expect(repair.checksum).toBe(caseCatalogRepairManifest(base).repair.checksum);
  });
  it('refuses application/old test owners before database work', async () => {
    const execute = vi.fn();
    for (const owner of ['SPORTIFY_SCHEMA_OWNER', 'SPORTIFY_TEST_OWNER'])
      await expect(reconcileCaseCatalogFailure({ execute }, owner, {})).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
  it('refuses an unrecognized installed history before any repair write', async () => {
    const base = await baseline();
    const execute = vi.fn(async (sql) => {
      if (sql.includes('DBMS_LOCK.ALLOCATE_UNIQUE'))
        return { outBinds: { result: 0, handle: 'unit-lock' } };
      if (sql.includes('DBMS_LOCK.RELEASE')) return { outBinds: { result: 0 } };
      return {
        rows: base.migrations.map((entry) => ({
          VERSION: entry.version,
          CHECKSUM: entry.checksum,
          EXECUTION_STATUS: 'APPLIED',
          REPAIR_VERSION: null,
        })),
      };
    });
    await expect(
      reconcileCaseCatalogFailure({ execute }, 'SPORTIFY_STEP08_TEST_OWNER', base),
    ).rejects.toThrow(/Exact observed/);
    expect(
      execute.mock.calls.some(([sql]) =>
        /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/.test(sql),
      ),
    ).toBe(false);
  });
});
