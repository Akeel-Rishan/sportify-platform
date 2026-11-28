import { isAbsolute } from 'node:path';
import { decodeKeyring, decodeSecret, type VerificationKeys } from '@sportify/verification-email';
import { EnvironmentError, type Environment } from '@sportify/validation';

export interface SessionConfig {
  readonly dashboardOrigin: URL;
  readonly secureCookies: boolean;
  readonly csrfKey: Buffer;
  readonly sourceKey: Buffer;
  readonly resetKeys: VerificationKeys;
  readonly resetKeyVersion: string;
  readonly passwordBlocklist: string;
  readonly absoluteSeconds: number;
  readonly idleSeconds: number;
  readonly touchSeconds: number;
  readonly resetSeconds: number;
  readonly resetCooldownSeconds: number;
  readonly resetAccountLimit: number;
  readonly resetMaxAttempts: number;
  readonly loginSourceLimit: number;
  readonly loginPairLimit: number;
  readonly sessionSourceLimit: number;
  readonly resetRequestSourceLimit: number;
  readonly resetConfirmSourceLimit: number;
}

export function parseSessionConfig(
  env: Environment,
  mode: 'development' | 'test' | 'production',
): SessionConfig | undefined {
  if (env.AUTH_ACCOUNT_ENABLED === undefined || env.AUTH_ACCOUNT_ENABLED === 'false')
    return undefined;
  function invalid(field: string): never {
    throw new EnvironmentError([
      `${field}: missing or invalid account authentication configuration`,
    ]);
  }
  if (env.AUTH_ACCOUNT_ENABLED !== 'true') invalid('AUTH_ACCOUNT_ENABLED');
  const loopback = env.AUTH_ALLOW_LOOPBACK_HTTP;
  if (loopback !== undefined && loopback !== 'false' && loopback !== 'true')
    invalid('AUTH_ALLOW_LOOPBACK_HTTP');
  if (loopback === 'true' && mode === 'production') invalid('AUTH_ALLOW_LOOPBACK_HTTP');
  const requested = env.AUTH_DASHBOARD_ORIGIN ?? '';
  if (!URL.canParse(requested)) invalid('AUTH_DASHBOARD_ORIGIN');
  const dashboardOrigin = new URL(requested);
  const secureCookies = dashboardOrigin.protocol === 'https:';
  if (
    requested !== dashboardOrigin.origin ||
    (!secureCookies &&
      (dashboardOrigin.protocol !== 'http:' ||
        loopback !== 'true' ||
        !['localhost', '127.0.0.1', '[::1]'].includes(dashboardOrigin.hostname)))
  )
    invalid('AUTH_DASHBOARD_ORIGIN');

  function key(field: string): Buffer {
    try {
      return decodeSecret(env[field] ?? '');
    } catch {
      return invalid(field);
    }
  }
  const csrfKey = key('AUTH_CSRF_KEY');
  const sourceKey = key('AUTH_SOURCE_KEY');
  if (csrfKey.equals(sourceKey)) invalid('AUTH_CSRF_KEY');

  let resetKeys: VerificationKeys;
  try {
    resetKeys = decodeKeyring(env.AUTH_RESET_KEYS ?? '');
  } catch {
    return invalid('AUTH_RESET_KEYS');
  }
  const resetKeyVersion = env.AUTH_RESET_KEY_VERSION ?? '';
  if (!resetKeys.has(resetKeyVersion)) invalid('AUTH_RESET_KEY_VERSION');
  if ([...resetKeys.values()].some((entry) => entry.equals(csrfKey) || entry.equals(sourceKey)))
    invalid('AUTH_RESET_KEYS');

  const passwordBlocklist = env.AUTH_PASSWORD_BLOCKLIST_PATH ?? '';
  if (!isAbsolute(passwordBlocklist) || passwordBlocklist.includes('\0'))
    invalid('AUTH_PASSWORD_BLOCKLIST_PATH');
  function integer(field: string, max: number, fallback?: number): number {
    if (env[field] === undefined && fallback !== undefined && fallback <= max) return fallback;
    const value = env[field] ?? '';
    if (!/^[1-9][0-9]{0,7}$/.test(value) || Number(value) > max) return invalid(field);
    return Number(value);
  }
  const absoluteSeconds = integer('AUTH_SESSION_ABSOLUTE_SECONDS', 2_592_000, 43_200);
  const idleSeconds = integer('AUTH_SESSION_IDLE_SECONDS', absoluteSeconds, 1_800);
  const touchSeconds = integer('AUTH_SESSION_TOUCH_SECONDS', idleSeconds - 1, 60);
  if (touchSeconds < 60) invalid('AUTH_SESSION_TOUCH_SECONDS');
  const resetSeconds = integer('AUTH_RESET_LIFETIME_SECONDS', 86_400, 1_800);
  return {
    dashboardOrigin,
    secureCookies,
    csrfKey,
    sourceKey,
    resetKeys,
    resetKeyVersion,
    passwordBlocklist,
    absoluteSeconds,
    idleSeconds,
    touchSeconds,
    resetSeconds,
    resetCooldownSeconds: integer('AUTH_RESET_COOLDOWN_SECONDS', 900, 60),
    resetAccountLimit: integer('AUTH_RESET_ACCOUNT_LIMIT', 9999, 3),
    resetMaxAttempts: integer('AUTH_RESET_OUTBOX_MAX_ATTEMPTS', 9999),
    loginSourceLimit: integer('AUTH_LOGIN_SOURCE_LIMIT', 9999, 30),
    loginPairLimit: integer('AUTH_LOGIN_PAIR_LIMIT', 9999),
    sessionSourceLimit: integer('AUTH_SESSION_SOURCE_LIMIT', 9999),
    resetRequestSourceLimit: integer('AUTH_RESET_REQUEST_SOURCE_LIMIT', 9999, 10),
    resetConfirmSourceLimit: integer('AUTH_RESET_CONFIRM_SOURCE_LIMIT', 9999, 30),
  };
}
