import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Database } from '@sportify/database';

export const verificationEvent = 'auth.email-verification.requested';
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const keyVersionPattern = /^[A-Za-z0-9_-]{1,30}$/;
export const tokenPattern = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
export type VerificationKeys = ReadonlyMap<string, Buffer>;

export function decodeSecret(encoded: string): Buffer {
  if (encoded.length !== 43 || !tokenPattern.test(encoded))
    throw new Error('A canonical 32-byte secret is required.');
  const secret = Buffer.from(encoded, 'base64url');
  if (secret.every((byte) => byte === secret[0])) throw new Error('Invalid secret material.');
  return secret;
}

export function decodeKeyring(input: string): VerificationKeys {
  if (input.length > 4096) throw new Error('Invalid email verification keyring.');
  let values: unknown;
  try {
    values = JSON.parse(input);
  } catch {
    throw new Error('Invalid email verification keyring.');
  }
  if (values === null || typeof values !== 'object' || Array.isArray(values))
    throw new Error('Invalid email verification keyring.');
  const entries = Object.entries(values) as [string, unknown][];
  if (!entries.length || entries.length > 8) throw new Error('Invalid email verification keyring.');
  const keys = new Map<string, Buffer>();
  for (const [version, value] of entries) {
    if (!keyVersionPattern.test(version) || typeof value !== 'string')
      throw new Error('Invalid email verification keyring entry.');
    const secret = decodeSecret(value);
    if ([...keys.values()].some((existing) => existing.equals(secret)))
      throw new Error('Email verification key versions must use distinct keys.');
    keys.set(version, secret);
  }
  return keys;
}

export interface VerificationReference {
  readonly tokenId: string;
  readonly keyVersion: string;
}

export interface VerificationContext extends VerificationReference {
  readonly userId: string;
  readonly expiresAt: string;
}

export function deriveVerificationToken(context: VerificationContext, key: Buffer): string {
  return createHmac('sha256', key)
    .update(
      JSON.stringify([
        'sportify.email-verification.v1',
        context.keyVersion,
        context.tokenId,
        context.userId,
        context.expiresAt,
      ]),
    )
    .digest('base64url');
}

export function tokenDigest(token: string): string {
  return createHash('sha256').update(token, 'ascii').digest('hex');
}

export interface VerificationMail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

type DeliveryResult =
  'sent' | 'ineligible' | 'key_unavailable' | 'record_mismatch' | 'delivery_failed';
export type SendVerificationMail = (mail: VerificationMail, signal: AbortSignal) => Promise<void>;

export function createVerificationDelivery(options: {
  readonly database: Pick<Database, 'query'>;
  readonly owner: 'SPORTIFY_SCHEMA_OWNER' | 'SPORTIFY_STEP11_TEST_OWNER';
  readonly origin: string;
  readonly keys: VerificationKeys;
  readonly send: SendVerificationMail;
  readonly report: (result: DeliveryResult) => void;
}): (reference: VerificationReference) => Promise<DeliveryResult> {
  if (!URL.canParse(options.origin)) throw new Error('Invalid email verification frontend origin.');
  const origin = new URL(options.origin);
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== '/'
  )
    throw new Error('Email verification requires a configured HTTPS frontend origin.');
  if (!['SPORTIFY_SCHEMA_OWNER', 'SPORTIFY_STEP11_TEST_OWNER'].includes(options.owner))
    throw new Error('An approved verification schema is required.');

  return async (reference) => {
    const finish = (result: DeliveryResult): DeliveryResult => {
      // The sink receives a fixed outcome only, even when a transport throws a sensitive error.
      try {
        options.report(result);
      } catch {
        /* Observability cannot change delivery state. */
      }
      return result;
    };
    if (!uuidPattern.test(reference.tokenId) || !keyVersionPattern.test(reference.keyVersion))
      return finish('record_mismatch');
    const key = options.keys.get(reference.keyVersion);
    if (!key) return finish('key_unavailable');
    try {
      const { rows } = await options.database.query<{
        USER_PUBLIC_ID: string;
        EMAIL: string;
        EXPIRES_AT: string;
        TOKEN_HASH: string;
      }>(
        `SELECT USER_PUBLIC_ID, EMAIL, EXPIRES_AT, TOKEN_HASH FROM ${options.owner}.VW_AUTH_VERIFICATION_MAIL
         WHERE PUBLIC_ID=:id AND TOKEN_KEY_VERSION=:version`,
        { id: reference.tokenId, version: reference.keyVersion },
      );
      const row = rows?.[0];
      if (!row) return finish('ineligible');
      const token = deriveVerificationToken(
        { ...reference, userId: row.USER_PUBLIC_ID, expiresAt: row.EXPIRES_AT },
        key,
      );
      if (
        !/^[0-9a-f]{64}$/.test(row.TOKEN_HASH) ||
        !timingSafeEqual(Buffer.from(row.TOKEN_HASH, 'hex'), Buffer.from(tokenDigest(token), 'hex'))
      )
        return finish('record_mismatch');
      const link = new URL('/verify-email', origin);
      link.hash = new URLSearchParams({ token }).toString();
      await options.send(
        {
          to: row.EMAIL,
          subject: 'Verify your SPORTIFY email address',
          text: `Open this link and confirm your SPORTIFY email address within 60 minutes of the request:\n\n${link.href}\n\nIf you did not request this, you can ignore this message.`,
        },
        AbortSignal.timeout(5000),
      );
      return finish('sent');
    } catch {
      return finish('delivery_failed');
    }
  };
}
