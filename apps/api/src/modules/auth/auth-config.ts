import { isAbsolute } from 'node:path';
import { decodeKeyring, decodeSecret, type VerificationKeys } from '@sportify/verification-email';
import { EnvironmentError, type Environment } from '@sportify/validation';

export interface RegistrationConfig {
  readonly keys: VerificationKeys;
  readonly activeVersion: string;
  readonly sourceKey: Buffer;
  readonly issueLimit: number;
  readonly confirmLimit: number;
  readonly maxAttempts: number;
  readonly passwordBlocklist: string;
}

export function parseRegistrationConfig(env: Environment): RegistrationConfig | undefined {
  if (env.AUTH_REGISTRATION_ENABLED === undefined || env.AUTH_REGISTRATION_ENABLED === 'false')
    return undefined;
  const invalid = (field: string): never => {
    throw new EnvironmentError([`${field}: missing or invalid registration configuration`]);
  };
  if (env.AUTH_REGISTRATION_ENABLED !== 'true') invalid('AUTH_REGISTRATION_ENABLED');
  const activeVersion = env.AUTH_EMAIL_KEY_VERSION ?? '';
  const passwordBlocklist = env.AUTH_PASSWORD_BLOCKLIST_PATH ?? '';
  if (!isAbsolute(passwordBlocklist) || passwordBlocklist.includes('\0'))
    invalid('AUTH_PASSWORD_BLOCKLIST_PATH');
  let keys: VerificationKeys;
  let sourceKey: Buffer;
  try {
    keys = decodeKeyring(env.AUTH_EMAIL_KEYS ?? '');
  } catch {
    return invalid('AUTH_EMAIL_KEYS');
  }
  if (!keys.has(activeVersion)) invalid('AUTH_EMAIL_KEY_VERSION');
  try {
    sourceKey = decodeSecret(env.AUTH_SOURCE_KEY ?? '');
  } catch {
    return invalid('AUTH_SOURCE_KEY');
  }
  if ([...keys.values()].some((key) => key.equals(sourceKey))) invalid('AUTH_SOURCE_KEY');
  function integer(field: string, fallback?: number): number {
    const raw = env[field];
    if (raw === undefined && fallback !== undefined) return fallback;
    if (!raw || !/^[1-9][0-9]{0,3}$/.test(raw)) return invalid(field);
    return Number(raw);
  }
  return {
    keys,
    activeVersion,
    passwordBlocklist,
    sourceKey,
    issueLimit: integer('AUTH_ISSUE_SOURCE_LIMIT', 10),
    confirmLimit: integer('AUTH_CONFIRM_SOURCE_LIMIT', 30),
    maxAttempts: integer('AUTH_VERIFICATION_OUTBOX_MAX_ATTEMPTS'),
  };
}
