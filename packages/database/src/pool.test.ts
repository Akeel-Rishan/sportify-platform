import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { afterAll, describe, expect, it, vi } from 'vitest';
import oracledb from 'oracledb';
import { createDatabase, fetchTypeHandler, type SqlConnection } from './pool.js';
import { parseDatabaseConfig } from './config.js';
import type { DatabaseEvent } from './errors.js';

const walletDirectory = mkdtempSync(join(tmpdir(), 'sportify-mock-wallet-'));
writeFileSync(join(walletDirectory, 'ewallet.pem'), 'UNIT TEST DUMMY FILE - NOT A CERTIFICATE');
afterAll(() => rmSync(walletDirectory, { recursive: true, force: true }));
const config = parseDatabaseConfig(
  {
    ORACLE_USER: 'SPORTIFY_API',
    ORACLE_PASSWORD: 'unit-secret',
    ORACLE_CONNECT_STRING: 'tcps://unit.invalid:1521/unit',
    ORACLE_WALLET_DIRECTORY: walletDirectory,
    ORACLE_WALLET_PASSWORD: 'unit-only-wallet-secret',
  },
  'api',
);
async function fixture() {
  const connection = {
    execute: vi.fn().mockResolvedValue({ rows: [{ PROBE: '1', SESSION_ZONE: 'UTC' }] }),
    rollback: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    callTimeout: 0,
  };
  const pool = {
    getConnection: vi.fn().mockResolvedValue(connection),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const events: DatabaseEvent[] = [];
  const factory = vi.fn().mockResolvedValue(pool);
  const database = await createDatabase(config, 'api', factory, (record) =>
    events.push(record.event),
  );
  return { connection, pool, events, factory, database };
}
describe('Oracle pool and transactions (driver mocks; unit only)', () => {
  it('passes mTLS wallet settings, strict certificate checks and bounded configuration without enabling Thick mode', async () => {
    const f = await fixture();
    expect(f.factory).toHaveBeenCalledWith(
      expect.objectContaining({
        walletLocation: walletDirectory,
        walletPassword: 'unit-only-wallet-secret',
        sslServerDNMatch: true,
        sslAllowWeakDNMatch: false,
        retryCount: 0,
        poolMax: 8,
        poolMin: 0,
        connectTimeout: 5,
        queueTimeout: 1500,
      }),
    );
    await f.database.close();
  });
  it('resets UTC on each acquisition, binds values, disables autocommit and releases', async () => {
    const f = await fixture();
    await f.database.query('SELECT :value FROM DUAL', { value: 'bound' });
    await f.database.query('SELECT :value FROM DUAL', { value: 'again' });
    expect(
      f.connection.execute.mock.calls.filter(
        (call) => call[0] === "ALTER SESSION SET TIME_ZONE = 'UTC'",
      ),
    ).toHaveLength(2);
    expect(f.connection.execute).toHaveBeenCalledWith(
      'SELECT :value FROM DUAL',
      { value: 'bound' },
      expect.objectContaining({ autoCommit: false }),
    );
    expect(f.connection.rollback).toHaveBeenCalledTimes(4);
    expect(f.connection.close).toHaveBeenCalledTimes(2);
    expect(f.connection.callTimeout).toBe(1500);
    expect(f.connection.commit).not.toHaveBeenCalled();
    await f.database.close();
  });
  it('commits only successful explicit transactions and prohibits escaped scopes', async () => {
    const f = await fixture();
    let escaped: SqlConnection | undefined;
    await f.database.transaction(async (c) => {
      escaped = c;
      await c.execute('UPDATE unit_fixture SET value=:value', { value: 'unit-only' });
    });
    expect(f.connection.commit).toHaveBeenCalledTimes(1);
    expect(f.connection.rollback).toHaveBeenCalledTimes(1);
    await expect(escaped?.execute('SELECT 1 FROM DUAL')).rejects.toThrow(/scope_closed/);
    await f.database.close();
  });
  it.each(['callback', 'commit', 'checkout', 'acquisition'] as const)(
    'releases after %s failure and preserves the original error',
    async (failure) => {
      const f = await fixture();
      const error = new Error('secret-sentinel');
      if (failure === 'commit') f.connection.commit.mockRejectedValue(error);
      if (failure === 'checkout') f.connection.execute.mockRejectedValue(error);
      if (failure === 'acquisition') f.pool.getConnection.mockRejectedValue(error);
      await expect(
        f.database.transaction(async (c) => {
          if (failure === 'callback') throw error;
          await c.execute('SELECT :v FROM DUAL', { v: 'unit' });
        }),
      ).rejects.toBe(error);
      expect(f.connection.close).toHaveBeenCalledTimes(failure === 'acquisition' ? 0 : 1);
      await f.database.close();
    },
  );
  it('preserves callback error through rollback/release failure; reports only fixed safe events', async () => {
    const f = await fixture();
    const original = new Error('secret-sentinel');
    f.connection.rollback.mockResolvedValueOnce(undefined).mockRejectedValue(original);
    f.connection.close.mockRejectedValue(original);
    await expect(f.database.transaction(() => Promise.reject(original))).rejects.toBe(original);
    expect(f.events).toEqual(['oracle.rollback.failed', 'oracle.release.failed']);
    expect(JSON.stringify(f.events)).not.toContain('secret-sentinel');
    expect(f.connection.close).toHaveBeenCalledWith({ drop: true });
    await f.database.close();
  });
  it('does not falsely report successful work if cleanup fails', async () => {
    const f = await fixture();
    f.connection.close.mockRejectedValue(new Error('private'));
    await expect(f.database.query('SELECT 1 FROM DUAL')).rejects.toThrow(/unavailable/);
    await f.database.close();
  });
  it('rejects implicit nested scopes without borrowing another connection', async () => {
    const f = await fixture();
    await expect(
      f.database.transaction(() => f.database.transaction(() => Promise.resolve())),
    ).rejects.toThrow(/nested_scope/);
    expect(f.pool.getConnection).toHaveBeenCalledTimes(1);
    await f.database.close();
  });
  it('keeps concurrent independent scopes isolated', async () => {
    const f = await fixture();
    await Promise.all([
      f.database.query('SELECT 1 FROM DUAL'),
      f.database.query('SELECT 2 FROM DUAL'),
    ]);
    expect(f.pool.getConnection).toHaveBeenCalledTimes(2);
    await f.database.close();
  });
  it('bounds shutdown, closes once and denies new work', async () => {
    const f = await fixture();
    f.database.stopAccepting();
    await expect(f.database.query('SELECT 1 FROM DUAL')).rejects.toThrow(/unavailable/);
    await Promise.all([f.database.close(), f.database.close()]);
    expect(f.pool.close).toHaveBeenCalledExactlyOnceWith(5);
  });
  it('makes probe failures safe and permits recovery', async () => {
    const f = await fixture();
    expect(await f.database.check()).toBe(true);
    f.pool.getConnection.mockRejectedValueOnce(new Error('secret-sentinel'));
    expect(await f.database.check()).toBe(false);
    expect(await f.database.check()).toBe(true);
    f.connection.execute.mockResolvedValue({ rows: [] });
    expect(await f.database.check()).toBe(false);
    await f.database.close();
  });
  it('sanitizes pool startup/close errors and isolates a failing log sink', async () => {
    await expect(
      createDatabase(
        config,
        'api',
        () => Promise.reject(new Error('secret-sentinel')),
        () => {
          throw new Error('sink');
        },
      ),
    ).rejects.toThrow('Database operation failed (unavailable).');
    const f = await fixture();
    f.pool.close.mockRejectedValue(new Error('secret-sentinel'));
    await expect(f.database.close()).rejects.toThrow('Database operation failed (unavailable).');
    expect(f.events).toEqual(['oracle.pool.close_failed']);
  });
  it('rejects unsafe numeric/Date bindings before execution', async () => {
    const f = await fixture();
    await expect(f.database.query('SELECT :value FROM DUAL', { value: 1.23 })).rejects.toThrow(
      /invalid_bind/,
    );
    // JavaScript callers must not bypass the UTC/precision contract either.
    await expect(
      f.database.query('SELECT :value FROM DUAL', {
        value: new Date() as unknown as string,
      }),
    ).rejects.toThrow(/invalid_bind/);
    await f.database.close();
  });
  it('waits for detached work before rollback/release and never commits it', async () => {
    const f = await fixture();
    let finish: (value: unknown) => void = () => {};
    f.connection.execute.mockResolvedValueOnce({ rows: [] }).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    let started: () => void = () => {};
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const operation = f.database.transaction((c) => {
      void c.execute('SELECT :value FROM DUAL', { value: 'detached-unit-only' });
      started();
      return Promise.resolve();
    });
    await startedPromise;
    expect(f.connection.close).not.toHaveBeenCalled();
    finish({ rows: [] });
    await expect(operation).rejects.toThrow(/scope_closed/);
    expect(f.connection.commit).not.toHaveBeenCalled();
    expect(f.connection.close).toHaveBeenCalledTimes(1);
    await f.database.close();
  });
  it('does not permit concurrent execution on one connection', async () => {
    const f = await fixture();
    let finish: (value: unknown) => void = () => {};
    f.connection.execute.mockResolvedValueOnce({ rows: [] }).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await f.database.withConnection(async (c) => {
      const first = c.execute('SELECT 1 FROM DUAL');
      await expect(c.execute('SELECT 2 FROM DUAL')).rejects.toThrow(/parallel_operation/);
      finish({ rows: [] });
      await first;
    });
    await f.database.close();
  });
  it('fetches NUMBER as a string before JS rounding; requires explicit temporal projections', () => {
    expect(fetchTypeHandler({ name: 'VALUE', dbType: oracledb.DB_TYPE_NUMBER })).toEqual({
      type: oracledb.DB_TYPE_VARCHAR,
    });
    expect(() => fetchTypeHandler({ name: 'VALUE', dbType: oracledb.DB_TYPE_TIMESTAMP })).toThrow(
      /temporal_projection_required/,
    );
    expect(fetchTypeHandler({ name: 'VALUE', dbType: oracledb.DB_TYPE_VARCHAR })).toBeUndefined();
  });
});
