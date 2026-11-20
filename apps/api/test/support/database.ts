import { resolve } from 'node:path';
import { vi } from 'vitest';
import type { Database } from '@sportify/database';
import { parseApiConfig } from '../../src/config/env.schema.js';

export const apiEnvironment = {
  NODE_ENV: 'test',
  PORT: '4000',
  ORACLE_USER: 'SPORTIFY_API',
  ORACLE_PASSWORD: 'unit-only',
  ORACLE_CONNECT_STRING: 'tcps://unit.invalid:1521/unit',
  ORACLE_WALLET_DIRECTORY: resolve('unit-wallet-not-loaded'),
  ORACLE_WALLET_PASSWORD: 'unit-only-wallet-secret',
};
export const apiConfig = () => parseApiConfig(apiEnvironment);
export function fakeDatabase(): Database {
  return {
    withConnection: vi.fn().mockRejectedValue(new Error('Unit fixture does not execute SQL')),
    transaction: vi.fn().mockRejectedValue(new Error('Unit fixture does not execute SQL')),
    query: vi.fn().mockRejectedValue(new Error('Unit fixture does not execute SQL')),
    check: vi.fn().mockResolvedValue(true),
    stopAccepting: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
}
