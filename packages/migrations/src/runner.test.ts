import { describe, expect, it, vi } from 'vitest';
import type { LoadedManifest, LoadedMigration, HistoryRecord } from './manifest.js';
import type { MigrationSession, MigrationEvent } from './session.js';
import { migrateSession, statusSession } from './runner.js';

function entry(version: string, sql: string): LoadedMigration {
  return {
    version,
    name: 'unit_fixture',
    kind: 'schema',
    repairOf: null,
    checksum: version.padEnd(64, 'a'),
    files: [{ path: `migrations/${version}_unit/001_table.sql`, format: 'sql' }],
    statements: [{ path: 'unit.sql', sql }],
    tables: [
      {
        name: version === '000001' ? 'SCHEMA_MIGRATIONS' : 'UNIT_FIXTURE',
        columns: [{ name: 'ID', type: 'NUMBER', nullable: false, default: null, identity: false }],
      },
    ],
    constraints: [],
    indexes: [],
    seeds: [],
  };
}
function fixture() {
  let exists = false;
  const history: HistoryRecord[] = [];
  const log: MigrationEvent[] = [];
  let failStatement: string | undefined;
  let lockResult = 0;
  const execute = vi.fn((sql: string, binds?: unknown) => {
    const values = binds as Record<string, unknown> | undefined;
    if (sql.includes('DBMS_LOCK.ALLOCATE_UNIQUE'))
      return Promise.resolve({ outBinds: { result: lockResult, handle: 'unit-handle' } });
    if (sql.includes('DBMS_LOCK.RELEASE')) return Promise.resolve({ outBinds: { result: 0 } });
    if (sql.includes('FROM USER_OBJECTS'))
      return Promise.resolve({
        rows: exists ? [{ OBJECT_NAME: 'SCHEMA_MIGRATIONS', OBJECT_TYPE: 'TABLE' }] : [],
      });
    if (sql.startsWith('SELECT VERSION'))
      return Promise.resolve({ rows: history.map((row) => ({ ...row })) });
    if (sql === failStatement) return Promise.reject(new Error('SECRET_ORACLE_SENTINEL'));
    if (sql.startsWith('CREATE TABLE SCHEMA_MIGRATIONS')) exists = true;
    if (sql.startsWith('INSERT INTO SCHEMA_MIGRATIONS'))
      history.push({
        VERSION: String(values?.version),
        CHECKSUM: String(values?.checksum),
        EXECUTION_STATUS: 'RUNNING',
        REPAIR_VERSION: null,
      });
    if (sql.startsWith('UPDATE SCHEMA_MIGRATIONS')) {
      const row = history.find((item) => item.VERSION === values?.version);
      if (row && row.EXECUTION_STATUS === 'RUNNING')
        row.EXECUTION_STATUS = sql.includes("EXECUTION_STATUS='APPLIED'") ? 'APPLIED' : 'FAILED';
    }
    return Promise.resolve({ rowsAffected: 1 });
  });
  const commit = vi.fn().mockResolvedValue(undefined),
    rollback = vi.fn().mockResolvedValue(undefined);
  const session = {
    execute,
    commit,
    rollback,
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as MigrationSession;
  const a = entry('000001', 'CREATE TABLE SCHEMA_MIGRATIONS (ID NUMBER)');
  const b = entry('000002', 'CREATE TABLE UNIT_FIXTURE (ID NUMBER)');
  const c = entry('000003', 'CREATE TABLE UNIT_LATER (ID NUMBER)');
  const manifest: LoadedManifest = {
    format: 1,
    status: 'ready',
    blockedBy: [],
    migrations: [a, b, c],
  };
  const verify = vi.fn().mockResolvedValue(undefined);
  return {
    session,
    execute,
    commit,
    rollback,
    history,
    manifest,
    verify,
    log,
    fail(sql: string) {
      failStatement = sql;
    },
    denyLock() {
      lockResult = 1;
    },
    unknownRegistry() {
      exists = true;
    },
  };
}
describe('owner migration execution (unit driver mocks; no Oracle evidence)', () => {
  it('registers RUNNING before later DDL, verifies before APPLIED, and makes a second run a no-op', async () => {
    const f = fixture();
    expect(
      await migrateSession(
        f.session,
        'SPORTIFY_SCHEMA_OWNER',
        f.manifest,
        (r) => f.log.push(r),
        f.verify,
      ),
    ).toEqual(['000001', '000002', '000003']);
    expect(f.history.map((row) => row.EXECUTION_STATUS)).toEqual(['APPLIED', 'APPLIED', 'APPLIED']);
    const ddl = f.execute.mock.calls.map((call) => call[0]);
    expect(ddl[0]).toContain('release_on_commit => FALSE');
    expect(ddl.indexOf('CREATE TABLE UNIT_FIXTURE (ID NUMBER)')).toBeGreaterThan(
      ddl.findIndex((sql) => sql.startsWith('INSERT INTO SCHEMA_MIGRATIONS')),
    );
    expect(f.execute.mock.calls.at(-1)?.[0]).toContain('DBMS_LOCK.RELEASE');
    const before = f.execute.mock.calls.filter((call) => call[0].startsWith('CREATE TABLE')).length;
    expect(
      await migrateSession(
        f.session,
        'SPORTIFY_SCHEMA_OWNER',
        f.manifest,
        (r) => f.log.push(r),
        f.verify,
      ),
    ).toEqual([]);
    expect(f.execute.mock.calls.filter((call) => call[0].startsWith('CREATE TABLE'))).toHaveLength(
      before,
    );
    expect(f.verify).toHaveBeenCalled();
  });
  it('stops after a controlled failure, retains FAILED history and emits no raw exception or SQL', async () => {
    const f = fixture();
    f.fail('CREATE TABLE UNIT_FIXTURE (ID NUMBER)');
    await expect(
      migrateSession(
        f.session,
        'SPORTIFY_SCHEMA_OWNER',
        f.manifest,
        (r) => f.log.push(r),
        f.verify,
      ),
    ).rejects.toThrow(/MIGRATION_FAILED/);
    expect(f.history.map((row) => row.EXECUTION_STATUS)).toEqual(['APPLIED', 'FAILED']);
    expect(f.execute.mock.calls.some((call) => call[0].includes('CREATE TABLE UNIT_LATER'))).toBe(
      false,
    );
    expect(f.rollback).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(f.log)).not.toContain('SECRET_ORACLE_SENTINEL');
    await expect(
      migrateSession(f.session, 'SPORTIFY_SCHEMA_OWNER', f.manifest, () => {}, f.verify),
    ).rejects.toThrow(/INCOMPLETE_HISTORY/);
  });
  it('stops if postconditions fail and never marks that migration applied', async () => {
    const f = fixture();
    f.verify.mockRejectedValueOnce(new Error('SECRET_CATALOG_SENTINEL'));
    await expect(
      migrateSession(f.session, 'SPORTIFY_SCHEMA_OWNER', f.manifest, () => {}, f.verify),
    ).rejects.toThrow(/MIGRATION_FAILED/);
    expect(f.history[0]?.EXECUTION_STATUS).toBe('FAILED');
    expect(f.history).toHaveLength(1);
  });
  it('refuses a preexisting empty registry instead of adopting it', async () => {
    const f = fixture();
    f.unknownRegistry();
    await expect(
      migrateSession(f.session, 'SPORTIFY_SCHEMA_OWNER', f.manifest, () => {}, f.verify),
    ).rejects.toThrow(/UNKNOWN_HISTORY/);
    await expect(statusSession(f.session, f.manifest)).rejects.toThrow(/UNKNOWN_HISTORY/);
    expect(f.execute.mock.calls.some((call) => call[0].startsWith('CREATE TABLE'))).toBe(false);
  });
  it('does no database work when design approval is missing', async () => {
    const f = fixture();
    f.manifest.status = 'review';
    await expect(
      migrateSession(f.session, 'SPORTIFY_SCHEMA_OWNER', f.manifest, () => {}, f.verify),
    ).rejects.toThrow(/DESIGN_REVIEW_REQUIRED/);
    expect(f.execute).not.toHaveBeenCalled();
  });
  it('refuses a second runner when its same-session advisory lock cannot be acquired', async () => {
    const f = fixture();
    f.denyLock();
    await expect(
      migrateSession(f.session, 'SPORTIFY_SCHEMA_OWNER', f.manifest, () => {}, f.verify),
    ).rejects.toThrow(/LOCK_UNAVAILABLE/);
    expect(f.execute).toHaveBeenCalledTimes(1);
    expect(f.commit).not.toHaveBeenCalled();
  });
  it('reports history-write failure without continuing or fabricating an APPLIED record', async () => {
    const f = fixture();
    f.fail('CREATE TABLE UNIT_FIXTURE (ID NUMBER)');
    f.commit
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('PRIVATE_COMMIT_SENTINEL'));
    await expect(
      migrateSession(f.session, 'SPORTIFY_SCHEMA_OWNER', f.manifest, () => {}, f.verify),
    ).rejects.toThrow(/HISTORY_WRITE_FAILED/);
    expect(f.history.some((row) => row.VERSION === '000003')).toBe(false);
  });
});
