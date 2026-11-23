import { describe, it, expect, vi } from 'vitest';
import { loadManifest, migrationChecksum } from '@sportify/migrations';
import { fileURLToPath } from 'node:url';
import {
  extendedStorageRepairManifest,
  reconcileExtendedStorageFailure,
} from '../support/extended-storage-recovery.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
async function baseline() {
  const release = await loadManifest(root);
  return { ...release, migrations: release.migrations.slice(0, 11) };
}
describe('explicit disposable extended-storage reconciliation (unit only)', () => {
  it('preserves release bytes and appends only a deterministic test repair', async () => {
    const base = await baseline();
    const { manifest, repair } = extendedStorageRepairManifest(base);
    expect(manifest.migrations.slice(0, 11)).toEqual(base.migrations);
    expect(repair.repairOf).toBe('000008');
    expect(repair.checksum).toBe(migrationChecksum(repair, repair.statements));
    expect(extendedStorageRepairManifest(base)).toEqual({ manifest, repair });
  });
  it('refuses the application owner before any database operation', async () => {
    const execute = vi.fn();
    await expect(
      reconcileExtendedStorageFailure({ execute }, 'SPORTIFY_SCHEMA_OWNER', await baseline()),
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
  it('refuses unexpected history before any repair marker is written', async () => {
    const execute = vi.fn((sql) =>
      Promise.resolve(
        sql.includes('DBMS_LOCK.REQUEST')
          ? { outBinds: { result: 0, handle: 'unit' } }
          : sql.includes('DBMS_LOCK.RELEASE')
            ? { outBinds: { result: 0 } }
            : { rows: [] },
      ),
    );
    await expect(
      reconcileExtendedStorageFailure({ execute }, 'SPORTIFY_TEST_OWNER', await baseline()),
    ).rejects.toThrow(/Exact unreconciled/);
    expect(execute.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
  });
});
