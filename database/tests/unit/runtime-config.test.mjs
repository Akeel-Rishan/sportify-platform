import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { runtimeVerificationConfigs } from '../support/runtime-privileges.mjs';

const shared = {
  ORACLE_CONNECT_STRING: 'tcps://unit.invalid:1522/unit',
  ORACLE_WALLET_DIRECTORY: resolve('unit-wallet-not-read'),
  ORACLE_WALLET_PASSWORD: 'PRIVATE_WALLET_SENTINEL',
  ORACLE_MIGRATION_PASSWORD: 'PRIVATE_OWNER_SENTINEL',
  ORACLE_PASSWORD: 'PRIVATE_OWNER_SENTINEL',
  ORACLE_USER: 'ADMIN',
};

describe('disposable runtime verifier credential boundary (unit; no connections)', () => {
  it('uses only the two explicit runtime credentials and fixed identities', () => {
    const entries = runtimeVerificationConfigs({
      ...shared,
      ORACLE_API_PASSWORD: 'PRIVATE_API_SENTINEL',
      ORACLE_WORKER_PASSWORD: 'PRIVATE_WORKER_SENTINEL',
    });
    expect(entries.map((entry) => entry.config.ORACLE_USER)).toEqual([
      'SPORTIFY_API',
      'SPORTIFY_WORKER',
    ]);
    expect(entries.map((entry) => entry.config.ORACLE_PASSWORD)).toEqual([
      'PRIVATE_API_SENTINEL',
      'PRIVATE_WORKER_SENTINEL',
    ]);
    expect(
      entries.every(
        (entry) =>
          entry.config.ORACLE_POOL_MAX === 1 && entry.config.ORACLE_QUEUE_TIMEOUT_MS === 5000,
      ),
    ).toBe(true);
  });
  it.each(['api', 'worker'])(
    'refuses a missing %s password rather than falling back to owner credentials',
    (role) => {
      const environment = {
        ...shared,
        ORACLE_API_PASSWORD: 'PRIVATE_API_SENTINEL',
        ORACLE_WORKER_PASSWORD: 'PRIVATE_WORKER_SENTINEL',
      };
      delete environment[`ORACLE_${role.toUpperCase()}_PASSWORD`];
      let caught;
      try {
        runtimeVerificationConfigs(environment);
      } catch (error) {
        caught = error;
      }
      expect(caught?.message).toContain('ORACLE_PASSWORD');
      expect(caught?.message).not.toContain('PRIVATE_');
      expect(caught?.message).not.toContain('unit.invalid');
    },
  );
});
