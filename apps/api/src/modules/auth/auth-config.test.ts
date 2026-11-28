import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parseRegistrationConfig } from './auth-config.js';

const encoded = () => randomBytes(32).toString('base64url');
const activeKey = encoded();
const valid = {
  AUTH_REGISTRATION_ENABLED: 'true',
  AUTH_EMAIL_KEYS: JSON.stringify({ v1: encoded(), v2: activeKey }),
  AUTH_EMAIL_KEY_VERSION: 'v2',
  AUTH_SOURCE_KEY: encoded(),
  AUTH_PASSWORD_BLOCKLIST_PATH: resolve('test-only-corpus'),
  AUTH_VERIFICATION_OUTBOX_MAX_ATTEMPTS: '4',
};

it('defaults disabled and supplies approved per-source defaults when explicitly enabled', () => {
  expect(parseRegistrationConfig({})).toBeUndefined();
  expect(parseRegistrationConfig({ AUTH_REGISTRATION_ENABLED: 'false' })).toBeUndefined();
  const configured = parseRegistrationConfig(valid);
  expect(configured).toMatchObject({
    activeVersion: 'v2',
    issueLimit: 10,
    confirmLimit: 30,
    maxAttempts: 4,
  });
  expect(configured?.keys.size).toBe(2);
  expect(
    parseRegistrationConfig({
      ...valid,
      AUTH_ISSUE_SOURCE_LIMIT: '7',
      AUTH_CONFIRM_SOURCE_LIMIT: '15',
    }),
  ).toMatchObject({ issueLimit: 7, confirmLimit: 15 });
});

it('rejects missing, reused or malformed security configuration without revealing entered values', () => {
  expect(() => parseRegistrationConfig({ ...valid, AUTH_EMAIL_KEYS: 'secret-bad-json' })).toThrow(
    'AUTH_EMAIL_KEYS',
  );
  expect(() =>
    parseRegistrationConfig({ ...valid, AUTH_EMAIL_KEYS: 'secret-bad-json' }),
  ).not.toThrow('secret-bad-json');
  expect(() => parseRegistrationConfig({ ...valid, AUTH_EMAIL_KEY_VERSION: 'missing' })).toThrow(
    'AUTH_EMAIL_KEY_VERSION',
  );
  expect(() => parseRegistrationConfig({ ...valid, AUTH_SOURCE_KEY: activeKey })).toThrow(
    'AUTH_SOURCE_KEY',
  );
  expect(() => parseRegistrationConfig({ ...valid, AUTH_PASSWORD_BLOCKLIST_PATH: '' })).toThrow(
    'AUTH_PASSWORD_BLOCKLIST_PATH',
  );
  expect(() => parseRegistrationConfig({ ...valid, AUTH_CONFIRM_SOURCE_LIMIT: '0' })).toThrow(
    'AUTH_CONFIRM_SOURCE_LIMIT',
  );
});
