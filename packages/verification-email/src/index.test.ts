import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Database } from '@sportify/database';
import { expect, it, vi } from 'vitest';
import {
  createPasswordResetDelivery,
  createVerificationDelivery,
  decodeKeyring,
  decodeSecret,
  deriveVerificationToken,
  derivePasswordResetToken,
  tokenDigest,
  tokenPattern,
  type VerificationMail,
} from './index.js';

const key = randomBytes(32);
const reference = { tokenId: 'b30b01c8-d813-41b8-8b66-59178bd35e69', keyVersion: 'v1' };
const context = {
  ...reference,
  userId: 'b68d2bc2-478a-4cba-a488-26b7f4139c39',
  expiresAt: '2026-11-27T10:00:00.123456',
};
const token = deriveVerificationToken(context, key);

it('binds reset links to their own purpose and rejects a verification digest', async () => {
  const reset = derivePasswordResetToken(context, key);
  expect(reset).toMatch(tokenPattern);
  expect(reset).not.toBe(token);
  const query = vi.fn<Database['query']>();
  const send = vi.fn<(mail: VerificationMail) => Promise<void>>().mockResolvedValue(undefined);
  const options = {
    database: { query: query as Database['query'] },
    owner: 'SPORTIFY_STEP12_TEST_OWNER' as const,
    origin: 'https://app.example.test',
    keys: new Map([['v1', key]]),
    send,
    report: vi.fn(),
  };
  const deliver = createPasswordResetDelivery(options);
  const row = {
    USER_PUBLIC_ID: context.userId,
    EMAIL: 'synthetic@example.test',
    EXPIRES_AT: context.expiresAt,
  };
  query.mockResolvedValueOnce({ rows: [{ ...row, TOKEN_HASH: tokenDigest(token) }] });
  expect(await deliver(reference)).toBe('record_mismatch');
  expect(send).not.toHaveBeenCalled();
  query.mockResolvedValueOnce({ rows: [{ ...row, TOKEN_HASH: tokenDigest(reset) }] });
  expect(await deliver(reference)).toBe('sent');
  expect(send.mock.calls[0]?.[0].text).toContain(
    `https://app.example.test/reset-password#token=${reset}`,
  );
  expect(query.mock.calls[0]?.[0]).toContain('VW_AUTH_PASSWORD_RESET_MAIL');
  query.mockResolvedValueOnce({ rows: [] });
  expect(await deliver(reference)).toBe('ineligible');
  expect(options.report.mock.calls.flat()).toEqual(['record_mismatch', 'sent', 'ineligible']);
});

it('derives canonical verification bearers bound to the record, user, expiry and version', () => {
  expect(token).toMatch(tokenPattern);
  expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  expect(deriveVerificationToken(context, key)).toBe(token);
  expect(deriveVerificationToken({ ...context, keyVersion: 'v2' }, key)).not.toBe(token);
  expect(deriveVerificationToken({ ...context, userId: 'another-user' }, key)).not.toBe(token);
  expect(deriveVerificationToken({ ...context, tokenId: 'another-record' }, key)).not.toBe(token);
  expect(deriveVerificationToken({ ...context, expiresAt: 'other expiry' }, key)).not.toBe(token);
  expect(decodeKeyring(JSON.stringify({ v1: key.toString('base64url') })).get('v1')).toEqual(key);
  expect(() => decodeSecret(Buffer.alloc(32).toString('base64url'))).toThrow();
  expect(() => decodeSecret(key.toString('base64url') + '\n')).toThrow();
  expect(() =>
    decodeKeyring(JSON.stringify({ a: key.toString('base64url'), b: key.toString('base64url') })),
  ).toThrow();
});

it('reports only redacted delivery results and places the bearer in a trusted URL fragment', async () => {
  const query = vi.fn<Database['query']>();
  const send = vi.fn<(mail: VerificationMail) => Promise<void>>().mockResolvedValue(undefined);
  const report = vi.fn();
  const options = {
    database: { query: query as Database['query'] },
    owner: 'SPORTIFY_STEP11_TEST_OWNER' as const,
    origin: 'https://signup.example.test',
    keys: new Map([['v1', key]]),
    send,
    report,
  };
  expect(() =>
    createVerificationDelivery({ ...options, origin: 'http://signup.example.test' }),
  ).toThrow();
  const deliver = createVerificationDelivery(options);
  const row = {
    USER_PUBLIC_ID: context.userId,
    EMAIL: 'synthetic@example.test',
    EXPIRES_AT: context.expiresAt,
    TOKEN_HASH: tokenDigest(token),
  };
  query.mockResolvedValueOnce({ rows: [row] });
  expect(await deliver(reference)).toBe('sent');
  expect(send.mock.calls[0]?.[0]).toMatchObject({ to: row.EMAIL });
  expect(send.mock.calls[0]?.[0].text).toContain(
    `https://signup.example.test/verify-email#token=${token}`,
  );
  expect(query.mock.calls[0]?.[0]).toContain('VW_AUTH_VERIFICATION_MAIL');
  query.mockResolvedValueOnce({ rows: [] });
  expect(await deliver(reference)).toBe('ineligible');
  expect(await deliver({ ...reference, keyVersion: 'retired' })).toBe('key_unavailable');
  query.mockResolvedValueOnce({ rows: [{ ...row, TOKEN_HASH: tokenDigest('other') }] });
  expect(await deliver(reference)).toBe('record_mismatch');
  query.mockResolvedValueOnce({ rows: [row] });
  send.mockRejectedValueOnce(new Error(`private transport message ${token}`));
  expect(await deliver(reference)).toBe('delivery_failed');
  expect(report.mock.calls.flat()).toEqual([
    'sent',
    'ineligible',
    'key_unavailable',
    'record_mismatch',
    'delivery_failed',
  ]);
});

it.each([
  { create: createVerificationDelivery, path: '/verify-email', bearer: token },
  {
    create: createPasswordResetDelivery,
    path: '/reset-password',
    bearer: derivePasswordResetToken(context, key),
  },
])(
  'passes a reconstructed $path message through a controlled loopback sink',
  async ({ create, path, bearer }) => {
    const inbox: string[] = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        inbox.push(Buffer.concat(chunks).toString());
        response.writeHead(204).end();
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    try {
      const query = vi.fn().mockResolvedValue({
        rows: [
          {
            USER_PUBLIC_ID: context.userId,
            EMAIL: 'synthetic@example.test',
            EXPIRES_AT: context.expiresAt,
            TOKEN_HASH: tokenDigest(bearer),
          },
        ],
      });
      const deliver = create({
        database: { query },
        owner: 'SPORTIFY_STEP11_TEST_OWNER',
        keys: new Map([['v1', key]]),
        origin: 'https://sportify.example.test',
        report: () => {},
        async send(mail, signal) {
          const port = (server.address() as AddressInfo).port;
          const result = await fetch(`http://127.0.0.1:${port}`, {
            method: 'POST',
            body: JSON.stringify(mail),
            signal,
          });
          if (result.status !== 204) throw new Error('Loopback sink failed.');
        },
      });
      expect(await deliver(reference)).toBe('sent');
      expect(inbox).toHaveLength(1);
      expect(inbox[0]).toContain('synthetic@example.test');
      expect(inbox[0]).toContain(`${path}#token=${bearer}`);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
);
