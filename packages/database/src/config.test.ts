import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDatabaseConfig } from './config.js';

const input = {
  ORACLE_USER: 'SPORTIFY_API',
  ORACLE_PASSWORD: 'secret-sentinel',
  ORACLE_CONNECT_STRING: 'tcps://unit.invalid:1521/unit',
  ORACLE_WALLET_DIRECTORY: resolve('unit-wallet-not-loaded'),
  ORACLE_WALLET_PASSWORD: 'unit-only-wallet-secret',
};
describe('Oracle configuration (unit; no connections)', () => {
  it('uses bounded role-specific defaults', () => {
    expect(parseDatabaseConfig(input, 'api')).toMatchObject({
      ORACLE_POOL_MIN: 0,
      ORACLE_POOL_MAX: 8,
      ORACLE_POOL_INCREMENT: 1,
      ORACLE_QUEUE_TIMEOUT_MS: 1500,
      ORACLE_CALL_TIMEOUT_MS: 1500,
    });
    expect(
      parseDatabaseConfig({ ...input, ORACLE_USER: 'SPORTIFY_WORKER' }, 'worker').ORACLE_POOL_MAX,
    ).toBe(2);
  });
  it.each([
    'ORACLE_USER',
    'ORACLE_PASSWORD',
    'ORACLE_CONNECT_STRING',
    'ORACLE_WALLET_DIRECTORY',
    'ORACLE_WALLET_PASSWORD',
  ])('requires %s without disclosing input', (key) => {
    const environment: Record<string, string> = { ...input };
    delete environment[key];
    try {
      parseDatabaseConfig(environment, 'api');
      throw new Error('Expected rejection');
    } catch (error) {
      expect(String(error)).toContain(key);
      expect(String(error)).not.toContain('secret-sentinel');
      expect(String(error)).not.toContain('unit-only-wallet-secret');
    }
  });
  it.each([
    { ORACLE_USER: 'ADMIN' },
    { ORACLE_USER: 'SPORTIFY_SCHEMA_OWNER' },
    { ORACLE_USER: 'SPORTIFY_WORKER' },
    { ORACLE_PASSWORD: '' },
    { ORACLE_WALLET_DIRECTORY: '' },
    { ORACLE_WALLET_DIRECTORY: 'relative/wallet' },
    { ORACLE_WALLET_DIRECTORY: resolve('wallet') + '\0' },
    { ORACLE_WALLET_PASSWORD: '' },
    { ORACLE_SCHEMA_OWNER: 'OWNER; DROP USER X' },
    { ORACLE_CONNECT_STRING: 'tcp://unit.invalid:1521/unit' },
    { ORACLE_CONNECT_STRING: 'tcps://unit.invalid:0/unit' },
    { ORACLE_CONNECT_STRING: 'tcps://unit.invalid:99999/unit' },
    { ORACLE_CONNECT_STRING: 'tcps://unit.invalid:1521/unit?ssl_server_dn_match=no' },
    { ORACLE_POOL_MIN: '3', ORACLE_POOL_MAX: '2' },
    { ORACLE_POOL_MAX: '9' },
    { ORACLE_POOL_INCREMENT: '3', ORACLE_POOL_MAX: '2' },
    { ORACLE_POOL_INCREMENT: '0' },
    { ORACLE_POOL_IDLE_SECONDS: '0' },
    { ORACLE_QUEUE_TIMEOUT_MS: '0' },
    { ORACLE_CALL_TIMEOUT_MS: '5001' },
    { ORACLE_POOL_MAX: '1.5' },
    { ORACLE_POOL_MIN: '-1' },
  ])('rejects unsafe/incompatible settings %#', (override) => {
    expect(() => parseDatabaseConfig({ ...input, ...override }, 'api')).toThrow(
      /Invalid environment/,
    );
  });
  it('caps worker capacity independently', () => {
    expect(() =>
      parseDatabaseConfig(
        { ...input, ORACLE_USER: 'SPORTIFY_WORKER', ORACLE_POOL_MAX: '3' },
        'worker',
      ),
    ).toThrow(/ORACLE_POOL_MAX/);
  });
});
