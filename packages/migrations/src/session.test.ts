import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { parseMigrationConfig } from './config.js';
import { withOwnerSession, withMigrationLock, type MigrationSession } from './session.js';

const directory = mkdtempSync(join(tmpdir(), 'sportify-migration-wallet-unit-'));
writeFileSync(join(directory, 'ewallet.pem'), 'UNIT DUMMY FILE - NOT A CERTIFICATE');
afterAll(() => rmSync(directory, { recursive: true, force: true }));
const config = parseMigrationConfig({
  ORACLE_MIGRATION_CONFIRM: 'designated-development',
  ORACLE_MIGRATION_DB_UNIQUE_NAME: 'UNIT_TARGET',
  ORACLE_MIGRATION_USER: 'SPORTIFY_SCHEMA_OWNER',
  ORACLE_MIGRATION_SCHEMA: 'SPORTIFY_SCHEMA_OWNER',
  ORACLE_MIGRATION_PASSWORD: 'PRIVATE_PASSWORD_SENTINEL',
  ORACLE_CONNECT_STRING: 'tcps://unit.invalid:1522/unit',
  ORACLE_WALLET_DIRECTORY: directory,
  ORACLE_WALLET_PASSWORD: 'PRIVATE_WALLET_SENTINEL',
});
function fixture() {
  const connection = {
    execute: vi.fn((sql: string) =>
      Promise.resolve({
        rows: sql.includes('NLS_DATABASE_PARAMETERS')
          ? [{ VALUE: 'AL32UTF8' }]
          : [
              {
                IDENTITY: 'SPORTIFY_SCHEMA_OWNER',
                SCHEMA_NAME: 'SPORTIFY_SCHEMA_OWNER',
                TARGET: 'UNIT_TARGET',
              },
            ],
      }),
    ),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    callTimeout: 0,
    oracleServerVersion: 2_600_000_000,
  };
  const factory = vi.fn().mockResolvedValue(connection);
  return { connection, factory };
}
describe('migration owner identity/lifecycle and advisory-lock protocol (unit)', () => {
  it('rejects a JS caller bypassing the owner parser before connecting', async () => {
    const f = fixture();
    const untrusted = { ...config, ORACLE_MIGRATION_USER: 'ADMIN' } as unknown as typeof config;
    await expect(withOwnerSession(untrusted, vi.fn(), f.factory)).rejects.toThrow(
      /ORACLE_MIGRATION_USER/,
    );
    expect(f.factory).not.toHaveBeenCalled();
  });
  it('verifies identity/schema/target before session changes, forwards mTLS and releases', async () => {
    const f = fixture();
    const work = vi.fn().mockResolvedValue('done');
    expect(await withOwnerSession(config, work, f.factory, () => {})).toBe('done');
    expect(f.connection.execute.mock.calls[0]?.[0]).toContain(
      "SYS_CONTEXT('USERENV','SESSION_USER')",
    );
    expect(f.connection.execute.mock.calls[2]?.[0]).toBe("ALTER SESSION SET TIME_ZONE = 'UTC'");
    expect(f.factory).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'SPORTIFY_SCHEMA_OWNER',
        sslServerDNMatch: true,
        walletLocation: directory,
        retryCount: 0,
      }),
    );
    expect(f.connection.close).toHaveBeenCalledTimes(1);
    expect(f.connection.callTimeout).toBe(30000);
  });
  it.each(['IDENTITY', 'SCHEMA_NAME', 'TARGET'])(
    'refuses wrong %s before mutation and closes the connection',
    async (field) => {
      const f = fixture();
      const identity = {
        IDENTITY: 'SPORTIFY_SCHEMA_OWNER',
        SCHEMA_NAME: 'SPORTIFY_SCHEMA_OWNER',
        TARGET: 'UNIT_TARGET',
        [field]: 'WRONG',
      };
      f.connection.execute.mockResolvedValue({ rows: [identity] });
      const work = vi.fn();
      await expect(withOwnerSession(config, work, f.factory, () => {})).rejects.toThrow(
        /TARGET_MISMATCH/,
      );
      expect(work).not.toHaveBeenCalled();
      expect(f.connection.execute).toHaveBeenCalledTimes(1);
      expect(f.connection.close).toHaveBeenCalledTimes(1);
    },
  );
  it('sanitizes connection errors and does not expose credential/endpoint diagnostics', async () => {
    const f = fixture();
    f.factory.mockRejectedValue(new Error('PRIVATE_PASSWORD_SENTINEL unit.invalid'));
    await expect(
      withOwnerSession(
        config,
        () => Promise.resolve(),
        f.factory,
        () => {},
      ),
    ).rejects.toThrow('Migration command failed (OWNER_CONNECTION_FAILED)');
  });
  it('preserves safe failure classification through rollback/close failure', async () => {
    const f = fixture();
    f.connection.rollback.mockRejectedValue(new Error('PRIVATE_ROLLBACK'));
    f.connection.close.mockRejectedValue(new Error('PRIVATE_CLOSE'));
    const log = vi.fn();
    await expect(
      withOwnerSession(config, () => Promise.reject(new Error('PRIVATE_ORIGINAL')), f.factory, log),
    ).rejects.toThrow(/MIGRATION_FAILED/);
    expect(log).toHaveBeenCalledWith({ event: 'migration.cleanup_failed', version: 'session' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_');
  });
  it('keeps a session advisory lock across callback commits and handles release codes', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ outBinds: { result: 0, handle: 'unit-handle' } })
      .mockResolvedValueOnce({ outBinds: { result: 0 } });
    const commit = vi.fn().mockResolvedValue(undefined);
    const session = { execute, commit } as unknown as MigrationSession;
    await withMigrationLock(
      session,
      'SPORTIFY_SCHEMA_OWNER',
      async () => {
        await session.commit();
      },
      () => {},
    );
    expect(execute.mock.calls[0]?.[0]).toContain('release_on_commit => FALSE');
    expect(execute.mock.calls[1]?.[0]).toContain('DBMS_LOCK.RELEASE');
    expect(commit).toHaveBeenCalledTimes(1);
  });
  it('reports release failure while retaining the original callback failure', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ outBinds: { result: 0, handle: 'unit-handle' } })
      .mockRejectedValueOnce(new Error('PRIVATE_RELEASE'));
    const original = new Error('unit-callback');
    const log = vi.fn();
    await expect(
      withMigrationLock(
        { execute } as unknown as MigrationSession,
        'SPORTIFY_SCHEMA_OWNER',
        () => Promise.reject(original),
        log,
      ),
    ).rejects.toBe(original);
    expect(log).toHaveBeenCalledWith({ event: 'migration.cleanup_failed', version: 'lock' });
  });
});
