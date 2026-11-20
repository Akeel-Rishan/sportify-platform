import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Database } from '@sportify/database';
import { startWorker } from './worker.js';
import { parseWorkerConfig } from './config/env.schema.js';
const config = () =>
  parseWorkerConfig({
    NODE_ENV: 'test',
    ORACLE_USER: 'SPORTIFY_WORKER',
    ORACLE_PASSWORD: 'unit-only',
    ORACLE_CONNECT_STRING: 'tcps://unit.invalid:1521/unit',
    ORACLE_WALLET_DIRECTORY: resolve('unit-wallet-not-loaded'),
    ORACLE_WALLET_PASSWORD: 'unit-only-wallet-secret',
  });
function fixture() {
  const database = { stopAccepting: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
  return { database, factory: () => Promise.resolve(database as unknown as Database) };
}
let worker: Awaited<ReturnType<typeof startWorker>> | undefined;
beforeEach(() => vi.useFakeTimers());
afterEach(async () => {
  await worker?.shutdown('SIGTERM').catch(() => {});
  worker = undefined;
  vi.useRealTimers();
});
it('invalid configuration creates no pool, timer or listeners', async () => {
  const f = fixture();
  const factory = vi.fn(f.factory);
  const invalid = config();
  invalid.NODE_ENV = 'private' as typeof invalid.NODE_ENV;
  await expect(startWorker(invalid, vi.fn(), factory)).rejects.toThrow(/NODE_ENV/);
  expect(factory).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it.each(['SIGINT', 'SIGTERM'] as const)(
  'cleans timers, pool and both listeners on %s exactly once',
  async (signal) => {
    const initial = process.listenerCount('SIGTERM');
    const f = fixture();
    const log = vi.fn();
    worker = await startWorker(config(), log, f.factory);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(2_147_483_647);
    expect(log).toHaveBeenCalledTimes(1);
    const listener = process.listeners(signal).at(-1);
    if (!listener) throw new Error('Missing handler');
    listener(signal);
    await worker.shutdown(signal);
    expect(vi.getTimerCount()).toBe(0);
    expect(process.listenerCount('SIGTERM')).toBe(initial);
    expect(f.database.close).toHaveBeenCalledTimes(1);
    expect(f.database.stopAccepting).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(2);
  },
);
it('cleans partial startup after an allocated pool and logger failure', async () => {
  const f = fixture();
  const initial = process.listenerCount('SIGTERM');
  const error = new Error('unit-only');
  await expect(
    startWorker(
      config(),
      () => {
        throw error;
      },
      f.factory,
    ),
  ).rejects.toBe(error);
  expect(f.database.close).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  expect(process.listenerCount('SIGTERM')).toBe(initial);
});
it('pool creation failure leaves no lifecycle resources', async () => {
  await expect(
    startWorker(config(), vi.fn(), () => Promise.reject(new Error('unit-only'))),
  ).rejects.toThrow('unit-only');
  expect(vi.getTimerCount()).toBe(0);
});
