import { describe, it, expect, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadManifest, migrationChecksum } from '@sportify/migrations';
import {
  caseCatalogRepairManifest,
  reconcileCaseCatalogFailure,
} from '../step09/catalog-recovery.mjs';

const source = () => loadManifest(fileURLToPath(new URL('../../', import.meta.url)));
describe('Step 09 exact CASE recovery (unit only; not Oracle evidence)', () => {
  it('retains all 26 source entries and creates only deterministic test-local repair metadata', async () => {
    const base = await source(),
      { manifest, repair } = caseCatalogRepairManifest(base);
    expect(manifest.migrations.slice(0, 26)).toEqual(base.migrations);
    expect(repair.version).toBe('000027');
    expect(repair.repairOf).toBe('000019');
    expect(repair.tables).toEqual([]);
    expect(repair.indexes).toEqual([]);
    expect(repair.checksum).toBe(migrationChecksum(repair, repair.statements));
    expect(caseCatalogRepairManifest(base)).toEqual({ manifest, repair });
  });
  it('rejects application, runtime and older test schemas before any database call', async () => {
    const execute = vi.fn();
    for (const owner of [
      'ADMIN',
      'SPORTIFY_SCHEMA_OWNER',
      'SPORTIFY_API',
      'SPORTIFY_WORKER',
      'SPORTIFY_TEST_OWNER',
      'SPORTIFY_STEP08_TEST_OWNER',
    ])
      await expect(reconcileCaseCatalogFailure({ execute }, owner, {})).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
  it('refuses unknown/partial history before catalog adoption or repair DML', async () => {
    const execute = vi.fn(async (sql) => {
      if (sql.includes('ALLOCATE_UNIQUE'))
        return { outBinds: { handle: 'synthetic-lock', result: 0 } };
      if (sql.includes('DBMS_LOCK.REQUEST')) return { outBinds: { result: 0 } };
      if (sql.includes('DBMS_LOCK.RELEASE')) return { outBinds: { result: 0 } };
      return {
        rows: [
          {
            VERSION: '000019',
            CHECKSUM: 'wrong',
            EXECUTION_STATUS: 'FAILED',
            REPAIR_VERSION: null,
          },
        ],
      };
    });
    await expect(
      reconcileCaseCatalogFailure({ execute }, 'SPORTIFY_STEP09_TEST_OWNER', await source()),
    ).rejects.toThrow(/exact observed/);
    expect(execute.mock.calls.some(([sql]) => sql.includes('FROM SCHEMA_MIGRATIONS'))).toBe(true);
    expect(
      execute.mock.calls.some(([sql]) => /\b(INSERT|UPDATE|DELETE|CREATE|ALTER)\b/.test(sql)),
    ).toBe(false);
  });
});
