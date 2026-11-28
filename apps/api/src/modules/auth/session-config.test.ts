import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseApiConfig } from '../../config/env.schema.js';
import { apiEnvironment } from '../../../test/support/database.js';
import { parseSessionConfig } from './session-config.js';

function settings() {
  const secret = () => randomBytes(32).toString('base64url');
  return {
    AUTH_ACCOUNT_ENABLED: 'true',
    AUTH_DASHBOARD_ORIGIN: 'https://app.example.test',
    AUTH_CSRF_KEY: secret(),
    AUTH_SOURCE_KEY: secret(),
    AUTH_RESET_KEYS: JSON.stringify({ r1: secret() }),
    AUTH_RESET_KEY_VERSION: 'r1',
    AUTH_PASSWORD_BLOCKLIST_PATH: resolve('test-corpus.txt'),
    AUTH_SESSION_ABSOLUTE_SECONDS: '3600',
    AUTH_SESSION_IDLE_SECONDS: '600',
    AUTH_SESSION_TOUCH_SECONDS: '60',
    AUTH_RESET_LIFETIME_SECONDS: '900',
    AUTH_RESET_COOLDOWN_SECONDS: '60',
    AUTH_RESET_ACCOUNT_LIMIT: '3',
    AUTH_RESET_OUTBOX_MAX_ATTEMPTS: '2',
    AUTH_LOGIN_SOURCE_LIMIT: '15',
    AUTH_LOGIN_PAIR_LIMIT: '5',
    AUTH_SESSION_SOURCE_LIMIT: '100',
    AUTH_RESET_REQUEST_SOURCE_LIMIT: '10',
    AUTH_RESET_CONFIRM_SOURCE_LIMIT: '15',
  };
}

describe('account configuration', () => {
  it('is opt-in and requires a canonical origin and all operating settings', () => {
    expect(parseSessionConfig({}, 'production')).toBeUndefined();
    const env = settings();
    expect(parseSessionConfig(env, 'production')).toMatchObject({
      secureCookies: true,
      absoluteSeconds: 3600,
      idleSeconds: 600,
      touchSeconds: 60,
    });
    for (const [field, value] of [
      ['AUTH_DASHBOARD_ORIGIN', 'https://app.example.test/path'],
      ['AUTH_DASHBOARD_ORIGIN', 'https://app.example.test?x=y'],
      ['AUTH_DASHBOARD_ORIGIN', 'null'],
      ['AUTH_SESSION_ABSOLUTE_SECONDS', ''],
      ['AUTH_SESSION_IDLE_SECONDS', '3601'],
      ['AUTH_SESSION_TOUCH_SECONDS', '600'],
      ['AUTH_SESSION_TOUCH_SECONDS', '59'],
      ['AUTH_RESET_LIFETIME_SECONDS', ''],
      ['AUTH_RESET_COOLDOWN_SECONDS', '901'],
      ['AUTH_RESET_ACCOUNT_LIMIT', ''],
      ['AUTH_LOGIN_SOURCE_LIMIT', ''],
      ['AUTH_RESET_REQUEST_SOURCE_LIMIT', '0'],
      ['AUTH_PASSWORD_BLOCKLIST_PATH', 'relative'],
    ] as const)
      expect(() => parseSessionConfig({ ...env, [field]: value }, 'production')).toThrow(field);
  });

  it('uses the approved configurable MVP defaults and requires the remaining operator limits', () => {
    const env: Record<string, string> = settings();
    for (const field of [
      'AUTH_SESSION_ABSOLUTE_SECONDS',
      'AUTH_SESSION_IDLE_SECONDS',
      'AUTH_SESSION_TOUCH_SECONDS',
      'AUTH_RESET_LIFETIME_SECONDS',
      'AUTH_RESET_COOLDOWN_SECONDS',
      'AUTH_RESET_ACCOUNT_LIMIT',
      'AUTH_LOGIN_SOURCE_LIMIT',
      'AUTH_RESET_REQUEST_SOURCE_LIMIT',
      'AUTH_RESET_CONFIRM_SOURCE_LIMIT',
    ])
      delete env[field];
    expect(parseSessionConfig(env, 'production')).toMatchObject({
      absoluteSeconds: 43_200,
      idleSeconds: 1_800,
      touchSeconds: 60,
      resetSeconds: 1_800,
      resetCooldownSeconds: 60,
      resetAccountLimit: 3,
      loginSourceLimit: 30,
      resetRequestSourceLimit: 10,
      resetConfirmSourceLimit: 30,
    });
    for (const field of [
      'AUTH_LOGIN_PAIR_LIMIT',
      'AUTH_SESSION_SOURCE_LIMIT',
      'AUTH_RESET_OUTBOX_MAX_ATTEMPTS',
    ])
      expect(() => parseSessionConfig({ ...env, [field]: undefined }, 'production')).toThrow(field);
  });

  it('rejects production HTTP and requires explicit loopback exception in test or development', () => {
    const env = { ...settings(), AUTH_DASHBOARD_ORIGIN: 'http://127.0.0.1:4000' };
    expect(() => parseSessionConfig(env, 'development')).toThrow('AUTH_DASHBOARD_ORIGIN');
    expect(() =>
      parseSessionConfig({ ...env, AUTH_ALLOW_LOOPBACK_HTTP: 'true' }, 'production'),
    ).toThrow('AUTH_ALLOW_LOOPBACK_HTTP');
    expect(
      parseSessionConfig({ ...env, AUTH_ALLOW_LOOPBACK_HTTP: 'true' }, 'test')?.secureCookies,
    ).toBe(false);
    expect(() =>
      parseSessionConfig(
        { ...env, AUTH_DASHBOARD_ORIGIN: 'http://example.test', AUTH_ALLOW_LOOPBACK_HTTP: 'true' },
        'test',
      ),
    ).toThrow('AUTH_DASHBOARD_ORIGIN');
  });

  it('rejects equal and invalid secrets and checks separation across feature modules', () => {
    const env = settings();
    expect(() =>
      parseSessionConfig({ ...env, AUTH_CSRF_KEY: env.AUTH_SOURCE_KEY }, 'test'),
    ).toThrow('AUTH_CSRF_KEY');
    expect(() =>
      parseSessionConfig({ ...env, AUTH_CSRF_KEY: 'synthetic-invalid-secret' }, 'test'),
    ).toThrow('AUTH_CSRF_KEY');
    expect(() =>
      parseSessionConfig(
        { ...env, AUTH_RESET_KEYS: JSON.stringify({ r1: env.AUTH_CSRF_KEY }) },
        'test',
      ),
    ).toThrow('AUTH_RESET_KEYS');
    expect(() => parseSessionConfig({ ...env, AUTH_RESET_KEY_VERSION: 'absent' }, 'test')).toThrow(
      'AUTH_RESET_KEY_VERSION',
    );
    const registration = {
      AUTH_REGISTRATION_ENABLED: 'true',
      AUTH_VERIFICATION_OUTBOX_MAX_ATTEMPTS: '2',
      AUTH_EMAIL_KEYS: JSON.stringify({ e1: env.AUTH_CSRF_KEY }),
      AUTH_EMAIL_KEY_VERSION: 'e1',
    };
    expect(() => parseApiConfig({ ...apiEnvironment, ...env, ...registration })).toThrow(
      'distinct from verification keys',
    );
    expect(
      parseApiConfig({
        ...apiEnvironment,
        ...env,
        ...registration,
        AUTH_EMAIL_KEYS: JSON.stringify({ e1: randomBytes(32).toString('base64url') }),
      }),
    ).toMatchObject({
      account: { resetKeyVersion: 'r1' },
      registration: { activeVersion: 'e1' },
    });
  });
});
