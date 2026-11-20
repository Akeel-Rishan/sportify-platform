import { expect, it, vi } from 'vitest';
import { ReadinessService } from './readiness.service.js';

it('requires initialization, shares concurrent probes, caches 1s and recovers from an outage (unit)', async () => {
  let now = 0;
  const database = { check: vi.fn().mockResolvedValue(true), stopAccepting: vi.fn() };
  const readiness = new ReadinessService(database, () => now);
  expect(await readiness.isReady()).toBe(false);
  readiness.onApplicationBootstrap();
  expect(
    await Promise.all([readiness.isReady(), readiness.isReady(), readiness.isReady()]),
  ).toEqual([true, true, true]);
  expect(database.check).toHaveBeenCalledTimes(1);
  database.check.mockRejectedValueOnce(new Error('private-oracle-sentinel'));
  expect(await readiness.isReady()).toBe(true); // bounded stale window, not a new probe
  now = 1000;
  expect(await readiness.isReady()).toBe(false);
  expect(await readiness.isReady()).toBe(false);
  now = 2000;
  expect(await readiness.isReady()).toBe(true);
  readiness.onModuleDestroy();
  expect(await readiness.isReady()).toBe(false);
  expect(database.stopAccepting).toHaveBeenCalledTimes(1);
});
it('cannot become ready again if shutdown occurs while a probe is in flight', async () => {
  let resolve: (value: boolean) => void = () => {};
  const readiness = new ReadinessService({
    check: () =>
      new Promise((r) => {
        resolve = r;
      }),
    stopAccepting: () => {},
  });
  readiness.onApplicationBootstrap();
  const pending = readiness.isReady();
  readiness.onModuleDestroy();
  resolve(true);
  expect(await pending).toBe(false);
});
