import { afterEach, expect, it, vi } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { createApiApplication, startApi } from './application.js';
import { apiConfig, apiEnvironment, fakeDatabase } from '../test/support/database.js';
const database = fakeDatabase();
const factory = () => Promise.resolve(database);

let app: INestApplication | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

it('rejects invalid configuration before constructing Nest or listening', async () => {
  const create = vi.spyOn(NestFactory, 'create');
  await expect(startApi({ NODE_ENV: 'test', PORT: '4000abc' })).rejects.toThrow(/PORT/);
  expect(create).not.toHaveBeenCalled();
});
it('creates an import-safe real Nest application with injected config and closes it', async () => {
  app = await createApiApplication(apiConfig(), () => {}, factory);
  await app.listen(0, '127.0.0.1');
  const url = await app.getUrl();
  expect((await fetch(url)).status).toBe(404);
  await app.close();
  app = undefined;
  await expect(fetch(url)).rejects.toThrow();
});

it('releases the failed Nest application when listening fails', async () => {
  app = await createApiApplication(apiConfig(), undefined, factory);
  await app.listen(0);
  const port = new URL(await app.getUrl()).port;
  const listenersBefore = process.listenerCount('SIGTERM');
  let unexpectedApplication: INestApplication | undefined;
  let failure: unknown;
  try {
    unexpectedApplication = await startApi({ ...apiEnvironment, PORT: port }, factory);
  } catch (error) {
    failure = error;
  } finally {
    await unexpectedApplication?.close();
  }
  expect(failure).toBeInstanceOf(Error);
  expect(process.listenerCount('SIGTERM')).toBe(listenersBefore);
});

it('closes an allocated pool if Nest construction fails (unit)', async () => {
  const error = new Error('private-startup-sentinel');
  vi.spyOn(NestFactory, 'create').mockRejectedValueOnce(error);
  const close = vi.fn().mockResolvedValue(undefined);
  const db = { ...fakeDatabase(), close };
  await expect(
    createApiApplication(apiConfig(), undefined, () => Promise.resolve(db)),
  ).rejects.toBe(error);
  expect(close).toHaveBeenCalledTimes(1);
});
it('does not construct Nest if pool initialization fails (unit)', async () => {
  const create = vi.spyOn(NestFactory, 'create');
  await expect(
    createApiApplication(apiConfig(), undefined, () => Promise.reject(new Error('pool failure'))),
  ).rejects.toThrow('pool failure');
  expect(create).not.toHaveBeenCalled();
});
