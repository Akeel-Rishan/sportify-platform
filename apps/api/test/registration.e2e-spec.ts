import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type { Database, SqlConnection } from '@sportify/database';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createApiApplication } from '../src/application.js';
import { parseApiConfig } from '../src/config/env.schema.js';
import { apiEnvironment, fakeDatabase } from './support/database.js';

const input = {
  email: '  Owner@Example.test  ',
  fullName: 'Pending sender',
  mobile: '+94770000000',
};
const token = randomBytes(32).toString('base64url');
const confirm = {
  token,
  password: 'different synthetic safe password',
  fullName: 'Mailbox holder',
  mobile: '+94770000001',
  tenantName: 'New facility',
};
const user = {
  USER_ID: '23',
  PUBLIC_ID: randomUUID(),
  VERIFICATION_ID: '5',
  TOKEN_KEY_VERSION: 'v1',
};
const execute = vi.fn<SqlConnection['execute']>();
const db: Database = {
  ...fakeDatabase(),
  transaction: (work) => work({ execute: execute as SqlConnection['execute'] }),
  query: execute as Database['query'],
};
const logs = vi.fn();
let app: INestApplication;
let folder: string;
let corpus: string;
let origin: string;
let insert: 'new' | 'duplicate' | 'failure' = 'new';
let sourceAvailable = true;
let activeToken = false;

beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'sportify-registration-'));
  corpus = join(folder, 'hashes.txt');
  await writeFile(corpus, `${'F'.repeat(40)}\n`);
  const version = randomBytes(32).toString('base64url');
  const config = parseApiConfig({
    ...apiEnvironment,
    AUTH_REGISTRATION_ENABLED: 'true',
    AUTH_EMAIL_KEY_VERSION: 'v1',
    AUTH_EMAIL_KEYS: JSON.stringify({ v1: version }),
    AUTH_SOURCE_KEY: randomBytes(32).toString('base64url'),
    AUTH_PASSWORD_BLOCKLIST_PATH: corpus,
    AUTH_VERIFICATION_OUTBOX_MAX_ATTEMPTS: '2',
  });
  const duplicate = (name: string) =>
    Object.assign(
      new Error(`ORA-00001: unique constraint (SPORTIFY_STEP11_TEST_OWNER.${name}) violated`),
      { errorNum: 1 },
    );
  execute.mockImplementation((sql) => {
    if (sql.startsWith('UPDATE SPORTIFY_STEP11_TEST_OWNER.AUTH_SOURCE_WINDOWS'))
      return Promise.resolve({ rowsAffected: sourceAvailable ? 1 : 0 });
    if (sql.startsWith('INSERT INTO SPORTIFY_STEP11_TEST_OWNER.AUTH_SOURCE_WINDOWS'))
      return Promise.reject(duplicate('PK_AUTH_SOURCE_WINDOWS'));
    if (sql.startsWith('INSERT INTO SPORTIFY_STEP11_TEST_OWNER.USERS')) {
      if (insert === 'duplicate') return Promise.reject(duplicate('UQ_USERS_EMAIL_NORMALIZED'));
      if (insert === 'failure') return Promise.reject(duplicate('UQ_USERS_PUBLIC_ID'));
    }
    if (sql.startsWith('SELECT USER_ID,PUBLIC_ID')) return Promise.resolve({ rows: [user] });
    if (sql.startsWith('SELECT TO_CHAR(LOCALTIMESTAMP'))
      return Promise.resolve({ rows: [{ EXPIRES_AT: '2026-11-27T10:00:00.123456' }] });
    if (sql.startsWith('SELECT u.USER_ID'))
      return Promise.resolve({ rows: activeToken ? [user] : [] });
    if (sql.startsWith('SELECT TENANT_ID FROM'))
      return Promise.resolve({ rows: [{ TENANT_ID: '31' }] });
    if (sql.startsWith('INSERT INTO SPORTIFY_STEP11_TEST_OWNER.ROLE_PERMISSIONS'))
      return Promise.resolve({ rowsAffected: 19 });
    return Promise.resolve({ rowsAffected: 1 });
  });
  app = await createApiApplication(
    config,
    logs,
    () => Promise.resolve(db),
    'SPORTIFY_STEP11_TEST_OWNER',
  );
  await app.listen(0, '127.0.0.1');
  origin = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
  if (corpus) await rm(corpus, { force: true });
  if (folder) await rmdir(folder);
});

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${origin}/api/v1/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

it('accepts a new and duplicate email identically and persists no credential or raw token at signup', async () => {
  insert = 'new';
  const fresh = await post('register', input);
  expect(fresh.status).toBe(202);
  expect(fresh.headers.get('cache-control')).toBe('no-store');
  expect(await fresh.json()).toEqual({
    success: true,
    data: { status: 'accepted' },
    requestId: fresh.headers.get('x-request-id'),
  });
  const created = execute.mock.calls.find(([sql]) =>
    sql.startsWith('INSERT INTO SPORTIFY_STEP11_TEST_OWNER.USERS'),
  );
  expect(created?.[0]).not.toContain('PASSWORD_HASH');
  expect(created?.[1]).toMatchObject({ email: 'owner@example.test' });
  const outbox = execute.mock.calls.find(([sql]) =>
    sql.includes('INSERT INTO SPORTIFY_STEP11_TEST_OWNER.OUTBOX_EVENTS'),
  );
  const payload: unknown = JSON.parse(String(outbox?.[1]?.payload));
  if (!payload || typeof payload !== 'object' || !('tokenId' in payload))
    throw new Error('Expected a reference-only verification payload.');
  expect(typeof payload.tokenId).toBe('string');
  expect(payload).toEqual({ tokenId: payload.tokenId, keyVersion: 'v1' });
  insert = 'duplicate';
  const duplicate = await post('register', { ...input, fullName: 'Untrusted re-registration' });
  expect(duplicate.status).toBe(202);
  expect(await duplicate.json()).toMatchObject({ data: { status: 'accepted' } });
  expect(execute.mock.calls.filter(([sql]) => sql.includes('OUTBOX_EVENTS'))).toHaveLength(1);
});

it('rejects unknown and ownership-bearing fields, and never consumes links on GET', async () => {
  const extra = await post('register', { ...input, tenantId: 'private-client-sentinel' });
  expect(extra.status).toBe(400);
  expect(await extra.text()).not.toContain('private-client-sentinel');
  const get = await fetch(`${origin}/api/v1/auth/verify-email?token=${token}`);
  expect(get.status).toBe(404);
  expect(execute.mock.calls.some(([sql]) => sql.includes('CONSUMED_AT_UTC=LOCALTIMESTAMP'))).toBe(
    false,
  );
});

it('does not mask unrelated unique failures and ignores unsanitized forwarded IPs', async () => {
  insert = 'failure';
  const failure = await post('register', input);
  expect(failure.status).toBe(500);
  expect(await failure.text()).not.toMatch(/ORA-|UQ_USERS/);
  sourceAvailable = false;
  try {
    const throttled = await post(
      'verification/resend',
      { email: 'owner@example.test' },
      { 'X-Forwarded-For': '192.0.2.1' },
    );
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get('retry-after')).toBe('900');
    const counts = execute.mock.calls.filter(([sql]) =>
      sql.startsWith('UPDATE SPORTIFY_STEP11_TEST_OWNER.AUTH_SOURCE_WINDOWS'),
    );
    expect(new Set(counts.map(([, binds]) => binds?.source))).toHaveProperty('size', 1);
  } finally {
    sourceAvailable = true;
  }
});

it('requires a live token, stores only the confirmed profile and password hash, and returns no session', async () => {
  activeToken = false;
  const expired = await post('verify-email', confirm);
  expect(expired.status).toBe(400);
  activeToken = true;
  const verified = await post('verify-email', confirm);
  expect(verified.status).toBe(200);
  expect(verified.headers.get('set-cookie')).toBeNull();
  expect(await verified.json()).toMatchObject({ success: true, data: { status: 'verified' } });
  const userUpdate = execute.mock.calls.find(([sql]) =>
    sql.startsWith('UPDATE SPORTIFY_STEP11_TEST_OWNER.USERS'),
  );
  expect(userUpdate?.[1]).toMatchObject({
    name: confirm.fullName,
    mobile: confirm.mobile,
  });
  expect(userUpdate?.[1]?.hash).toMatch(/^\$argon2id\$/);
  expect(JSON.stringify(logs.mock.calls)).not.toContain(token);
  expect(JSON.stringify(logs.mock.calls)).not.toContain(confirm.password);
  expect(JSON.stringify(logs.mock.calls)).not.toContain(input.email.trim());
});
