import { describe, it, expect } from 'vitest';
import { loadManifest, migrationChecksum, planMigrations } from '@sportify/migrations';
import { fileURLToPath } from 'node:url';
import { failureFixtureManifest } from '../support/failure-recovery.mjs';

describe('disposable failure/repair plan (unit only; no Oracle connection)', () => {
  it('preserves release entries and deterministically checksums appended fixture phases', async () => {
    const base = await loadManifest(fileURLToPath(new URL('../../', import.meta.url)));
    const fixture = failureFixtureManifest(base);
    expect(fixture.manifest.status).toBe(base.status);
    expect(fixture.manifest.blockedBy).toEqual(base.blockedBy);
    expect(fixture.manifest.migrations.slice(0, base.migrations.length)).toEqual(base.migrations);
    expect(failureFixtureManifest(base)).toEqual(fixture);
    for (const entry of [fixture.failed, fixture.later, fixture.repair])
      expect(migrationChecksum(entry, entry.statements)).toBe(entry.checksum);
    expect(fixture.failed.statements[1].sql).toContain('MISSING_FIELD');
    expect(fixture.repair.repairOf).toBe(fixture.failed.version);
  });
  it('refuses unreconciled failure and admits the later phase only after a matching retained repair', async () => {
    const base = await loadManifest(fileURLToPath(new URL('../../', import.meta.url)));
    const { manifest, failed, later, repair } = failureFixtureManifest(base);
    const applied = (entry) => ({
      VERSION: entry.version,
      CHECKSUM: entry.checksum,
      EXECUTION_STATUS: 'APPLIED',
      REPAIR_VERSION: null,
    });
    const history = [
      ...base.migrations.map(applied),
      { ...applied(failed), EXECUTION_STATUS: 'FAILED' },
    ];
    expect(() => planMigrations(manifest, history)).toThrow(/INCOMPLETE_HISTORY/);
    history.at(-1).REPAIR_VERSION = repair.version;
    history.push(applied(repair));
    expect(planMigrations(manifest, history)).toEqual([later]);
    history.at(-1).CHECKSUM = '0'.repeat(64);
    expect(() => planMigrations(manifest, history)).toThrow(/ARTIFACT_CHANGED/);
  });
});
