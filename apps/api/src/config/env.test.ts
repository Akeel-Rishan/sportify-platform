import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseApiEnv } from './env.schema.js';
import { loadApiEnv } from './env.js';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('API environment contract', () => {
  it('applies absent defaults and does not expose unrelated environment values', () => {
    expect(parseApiEnv({ UNUSED_SECRET: 'not-returned' })).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
    });
  });
  it.each(['development', 'test', 'production'])('accepts explicit NODE_ENV %s', (mode) => {
    expect(parseApiEnv({ NODE_ENV: mode, PORT: '65535' })).toEqual({ NODE_ENV: mode, PORT: 65535 });
    expect(parseApiEnv({ PORT: '1' }).PORT).toBe(1);
  });
  it.each([
    '0',
    '-1',
    '65536',
    '1.5',
    '4000abc',
    ' 4000',
    '4000 ',
    '',
    'NaN',
    'Infinity',
    '1e3',
    '999999999999999999999999',
  ])('rejects invalid PORT %j without echoing it', (port) => {
    expect(() => parseApiEnv({ PORT: port })).toThrow(/PORT: expected an integer/);
  });
  it.each(['', 'staging', 'private-secret-value'])(
    'rejects unsupported NODE_ENV %j safely',
    (mode) => {
      expect(() => parseApiEnv({ NODE_ENV: mode })).toThrow(
        'NODE_ENV: expected development, test or production',
      );
      try {
        parseApiEnv({ NODE_ENV: mode, PORT: 'private-port-secret' });
      } catch (error) {
        expect(String(error)).not.toContain('private-secret-value');
        expect(String(error)).not.toContain('private-port-secret');
      }
    },
  );
  it('loads app-relative files in priority order without mutating the injected object', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sportify-api-env-'));
    directories.push(directory);
    writeFileSync(join(directory, '.env.local'), 'PORT=4201\n');
    writeFileSync(join(directory, '.env'), 'PORT=4202\nNODE_ENV=development\n');
    const injected = { PORT: '4200' };
    expect(loadApiEnv(injected, directory).PORT).toBe(4200);
    expect(injected).toEqual({ PORT: '4200' });
    expect(loadApiEnv({}, directory).PORT).toBe(4201);
    rmSync(join(directory, '.env.local'));
    expect(loadApiEnv({}, directory).PORT).toBe(4202);
    expect(() => loadApiEnv({ PORT: '' }, directory)).toThrow(/PORT/);
  });
  it('does not load development files in production or tests', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sportify-api-env-'));
    directories.push(directory);
    writeFileSync(join(directory, '.env'), 'PORT=invalid\n');
    for (const mode of ['production', 'test'])
      expect(loadApiEnv({ NODE_ENV: mode }, directory).PORT).toBe(4000);
  });
  it('handles absent files, default process boundary and unreadable file safely', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sportify-api-env-'));
    directories.push(directory);
    expect(loadApiEnv({}, directory).PORT).toBe(4000);
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PORT', '4300');
    expect(loadApiEnv().PORT).toBe(4300);
    mkdirSync(join(directory, '.env.local'));
    expect(() => loadApiEnv({}, directory)).toThrow('.env.local: could not read');
  });
});
