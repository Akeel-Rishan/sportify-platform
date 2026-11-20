import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { parseWorkerEnv } from './env.schema.js';
import { loadWorkerEnv as rawLoadWorkerEnv } from './env.js';

const databaseEnvironment = {
  ORACLE_USER: 'SPORTIFY_WORKER',
  ORACLE_PASSWORD: 'unit-only-password',
  ORACLE_CONNECT_STRING: 'tcps://unit.invalid:1521/unit',
  ORACLE_WALLET_DIRECTORY: resolve('unit-wallet-not-loaded'),
  ORACLE_WALLET_PASSWORD: 'unit-only-wallet-secret',
};
function loadWorkerEnv(injected?: Parameters<typeof rawLoadWorkerEnv>[0], directory?: string) {
  return rawLoadWorkerEnv(
    injected === undefined ? undefined : { ...databaseEnvironment, ...injected },
    directory,
  );
}
beforeEach(() => {
  for (const [key, value] of Object.entries(databaseEnvironment)) vi.stubEnv(key, value);
});
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

it('defaults only when NODE_ENV is absent and strips unrelated input', () => {
  expect(parseWorkerEnv({ PRIVATE: 'secret' })).toEqual({ NODE_ENV: 'development' });
});
it.each(['development', 'test', 'production'])('accepts NODE_ENV %s', (mode) => {
  expect(parseWorkerEnv({ NODE_ENV: mode }).NODE_ENV).toBe(mode);
});
it.each(['', 'staging', 'private-token'])('rejects invalid mode %j safely', (mode) => {
  expect(() => parseWorkerEnv({ NODE_ENV: mode })).toThrow(
    'NODE_ENV: expected development, test or production',
  );
  try {
    parseWorkerEnv({ NODE_ENV: mode });
  } catch (error) {
    expect(String(error)).not.toContain('private-token');
  }
});
it('loads files in app directory with process > local > base precedence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sportify-worker-env-'));
  directories.push(directory);
  writeFileSync(join(directory, '.env.local'), 'NODE_ENV=test\n');
  writeFileSync(join(directory, '.env'), 'NODE_ENV=production\n');
  expect(loadWorkerEnv({}, directory).NODE_ENV).toBe('test');
  expect(loadWorkerEnv({ NODE_ENV: 'development' }, directory).NODE_ENV).toBe('development');
  rmSync(join(directory, '.env.local'));
  expect(loadWorkerEnv({}, directory).NODE_ENV).toBe('production');
  expect(() => loadWorkerEnv({ NODE_ENV: '' }, directory)).toThrow(/NODE_ENV/);
});
it('uses explicit production/test values without files and validates process defaults', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sportify-worker-env-'));
  directories.push(directory);
  writeFileSync(join(directory, '.env'), 'NODE_ENV=private-token\n');
  for (const mode of ['test', 'production'])
    expect(loadWorkerEnv({ NODE_ENV: mode }, directory).NODE_ENV).toBe(mode);
  vi.stubEnv('NODE_ENV', 'test');
  expect(loadWorkerEnv().NODE_ENV).toBe('test');
});
it('accepts absent files but rejects unreadable files with no supplied contents', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sportify-worker-env-'));
  directories.push(directory);
  expect(loadWorkerEnv({}, directory).NODE_ENV).toBe('development');
  mkdirSync(join(directory, '.env.local'));
  expect(() => loadWorkerEnv({}, directory)).toThrow('.env.local: could not read');
});
