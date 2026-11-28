import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { request as rawRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { DatabaseError, type Database, type SqlConnection } from '@sportify/database';
import { tokenDigest } from '@sportify/verification-email';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiApplication } from '../src/application.js';
import { parseApiConfig } from '../src/config/env.schema.js';
import { createPasswordEncoder } from '../src/modules/auth/password.js';
import { apiEnvironment, fakeDatabase } from './support/database.js';

const secret = () => randomBytes(32).toString('base64url');
const password = 'synthetic password for test fixtures';
const passwordNext = 'another synthetic test-only password';
const identity = { USER_ID: '42', PUBLIC_ID: randomUUID(), FULL_NAME: 'Test owner' };
const email = 'owner@example.test';
let app: INestApplication;
let origin: string;
let folder: string;
let storedHash: string;
let eligible: boolean;
let currentHash: string;
let unavailable: boolean;
let loginCommitFails: boolean;
let connectionEnded: boolean;
let resetDigest: string | undefined;
const sessions = new Map<string, { id: string; live: boolean }>();
const logs = vi.fn();
const execute = vi.fn<SqlConnection['execute']>();
const db: Database = {
  ...fakeDatabase(),
  transaction: async (work) => {
    const result = await work({ execute: execute as SqlConnection['execute'] });
    if (loginCommitFails && typeof result === 'object' && result !== null && 'token' in result)
      throw new DatabaseError('unavailable');
    return result;
  },
  query: execute as Database['query'],
  close: () => {
    connectionEnded = true;
    return Promise.resolve();
  },
};

beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'sportify-account-http-'));
  const corpus = join(folder, 'hashes.txt');
  await writeFile(corpus, 'F'.repeat(40) + '\n');
  storedHash = await createPasswordEncoder(corpus)(password);
  const config = parseApiConfig({
    ...apiEnvironment,
    AUTH_ACCOUNT_ENABLED: 'true',
    AUTH_DASHBOARD_ORIGIN: 'http://127.0.0.1',
    AUTH_ALLOW_LOOPBACK_HTTP: 'true',
    AUTH_CSRF_KEY: secret(),
    AUTH_SOURCE_KEY: secret(),
    AUTH_RESET_KEYS: JSON.stringify({ r1: secret() }),
    AUTH_RESET_KEY_VERSION: 'r1',
    AUTH_PASSWORD_BLOCKLIST_PATH: corpus,
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
  });
  execute.mockImplementation((sql, binds) => {
    if (unavailable) return Promise.reject(new DatabaseError('unavailable'));
    const digest = String(binds?.digest);
    if (sql.includes('u.PASSWORD_HASH'))
      return Promise.resolve({
        rows:
          eligible && binds?.email === email ? [{ ...identity, PASSWORD_HASH: currentHash }] : [],
      });
    if (sql.startsWith('INSERT INTO SPORTIFY_SCHEMA_OWNER.VW_AUTH_DASHBOARD_SESSIONS')) {
      sessions.set(digest, { id: String(sessions.size + 1), live: true });
      return Promise.resolve({ rowsAffected: 1 });
    }
    if (sql.startsWith('SELECT TO_CHAR(EXPIRES_AT_UTC')) {
      return Promise.resolve({
        rows: [{ DEADLINE: new Date(Date.now() + 3600000).toISOString().slice(0, -1) }],
      });
    }
    if (sql.includes('AS TOUCH_DUE')) {
      return Promise.resolve({
        rows: sessions.get(digest)?.live && eligible ? [{ ...identity, TOUCH_DUE: 'N' }] : [],
      });
    }
    if (sql.includes('s.SESSION_ID FROM')) {
      const session = sessions.get(digest);
      return Promise.resolve({
        rows: session?.live ? [{ ...identity, SESSION_ID: session.id }] : [],
      });
    }
    if (sql.includes("REVOKE_REASON='LOGOUT'")) {
      const session = [...sessions.values()].find(
        (entry) => entry.id === binds?.sessionId && entry.live,
      );
      if (session) session.live = false;
      return Promise.resolve({ rowsAffected: session ? 1 : 0 });
    }
    if (sql.includes('WHERE EMAIL_NORMALIZED=:email FOR UPDATE'))
      return Promise.resolve({ rows: eligible && binds?.email === email ? [identity] : [] });
    if (sql.includes('USER_ID=:accountId AND u.EMAIL_NORMALIZED'))
      return Promise.resolve({ rows: eligible ? [identity] : [] });
    if (sql.includes('COOLDOWN')) return Promise.resolve({ rows: [{ TOTAL: '0', COOLDOWN: '0' }] });
    if (sql.includes('TO_CHAR(LOCALTIMESTAMP+NUMTODSINTERVAL')) {
      return Promise.resolve({ rows: [{ DEADLINE: '2026-11-28T12:34:56.123456' }] });
    }
    if (sql.includes('JOIN SPORTIFY_SCHEMA_OWNER.USERS u') && sql.includes('t.TOKEN_HASH'))
      return Promise.resolve({
        rows:
          eligible && resetDigest === digest
            ? [{ ...identity, RESET_ID: '7', TOKEN_KEY_VERSION: 'r1' }]
            : [],
      });
    if (sql.includes('SET CONSUMED_AT_UTC=LOCALTIMESTAMP')) {
      resetDigest = undefined;
      return Promise.resolve({ rowsAffected: 1 });
    }
    if (sql.includes('SET PASSWORD_HASH=:encoded') && typeof binds?.encoded === 'string')
      currentHash = binds.encoded;
    if (sql.includes("REVOKE_REASON='PASSWORD_RESET'"))
      for (const session of sessions.values()) session.live = false;
    return Promise.resolve({ rowsAffected: 1 });
  });
  app = await createApiApplication(config, logs, () => Promise.resolve(db));
  await app.listen(0, '127.0.0.1');
  origin = await app.getUrl();
  if (!config.account) throw new Error('Expected auth test config.');
  config.account.dashboardOrigin.port = new URL(origin).port;
});

beforeEach(() => {
  sessions.clear();
  eligible = true;
  unavailable = false;
  loginCommitFails = false;
  currentHash = storedHash;
  resetDigest = undefined;
});

afterAll(async () => {
  await app?.close();
  if (folder) await rm(folder, { recursive: true, force: true });
  if (app) expect(connectionEnded).toBe(true);
});

async function browser(existing = '') {
  const response = await http('csrf', { headers: { Cookie: existing, 'X-CSRF-Bootstrap': '1' } });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const csrfCookie = response.headers.getSetCookie()[0]?.split(';')[0];
  const payload = (await response.json()) as { data: { csrfToken: string } };
  return {
    csrf: payload.data.csrfToken,
    cookies: [existing, csrfCookie].filter(Boolean).join('; '),
  };
}

function http(path: string, init?: RequestInit) {
  return fetch(`${origin}/api/v1/auth/${path}`, init);
}

function post(
  path: string,
  data: unknown,
  agent?: { csrf: string; cookies: string },
  headers: Record<string, string> = {},
) {
  return http(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      ...(agent ? { Cookie: agent.cookies, 'X-CSRF-Token': agent.csrf } : {}),
      ...headers,
    },
    body: JSON.stringify(data),
  });
}

async function login() {
  const agent = await browser();
  const response = await post('login', { email: '  Owner@Example.test ', password }, agent);
  expect(response.status).toBe(200);
  const cookie = response.headers.getSetCookie()[0];
  if (!cookie) throw new Error('Expected login cookie.');
  expect(cookie).toMatch(/^sportify_session_dev=/);
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('SameSite=Lax');
  expect(cookie).toContain('Path=/');
  expect(cookie).toContain('Expires=');
  expect(cookie).not.toMatch(/Domain|Secure/);
  const pair = cookie.split(';')[0] ?? '';
  const token = pair.slice(pair.indexOf('=') + 1);
  expect(token).toHaveLength(43);
  expect(sessions.has(tokenDigest(token))).toBe(true);
  expect(sessions.has(token)).toBe(false);
  const body = await response.text();
  expect(body).not.toContain(token);
  expect(JSON.parse(body)).toEqual({
    success: true,
    data: {
      account: { publicId: identity.PUBLIC_ID, fullName: identity.FULL_NAME, emailVerified: true },
    },
    requestId: response.headers.get('x-request-id'),
  });
  return { token, pair, agent };
}

describe('account HTTP boundary', () => {
  it('is no-store and keeps separate device cookies, revokes only the current device, and supports a fresh idempotent logout', async () => {
    const a = await login();
    const b = await login();
    expect(a.token).not.toBe(b.token);
    const me = (cookie: string) => http('me', { headers: { Cookie: cookie } });
    expect((await me(a.pair)).status).toBe(200);
    expect((await me(b.pair)).status).toBe(200);
    const aBound = await browser(a.pair + '; ' + a.agent.cookies);
    const bad = await post('logout', {}, { ...aBound, csrf: a.agent.csrf });
    expect(bad.status).toBe(403);
    const result = await post('logout', {}, aBound);
    expect(result.status).toBe(204);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(result.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^sportify_session_dev=; Path=\/;.*HttpOnly; SameSite=Lax$/),
      ]),
    );
    expect((await me(a.pair)).status).toBe(401);
    expect((await me(b.pair)).status).toBe(200);
    expect((await post('logout', {}, await browser())).status).toBe(204);
  });

  it('uses the same credential failure for missing, wrong, malformed and ineligible accounts', async () => {
    const agent = await browser();
    const input = { email, password };
    const wrong = await post('login', { email, password: 'wrong' }, agent);
    const unknown = await post('login', { ...input, email: 'missing@example.test' }, agent);
    eligible = false;
    const inactive = await post('login', input, agent);
    eligible = true;
    currentHash = 'malformed-secret-record';
    const malformed = await post('login', input, agent);
    const responses = await Promise.all(
      [wrong, unknown, inactive, malformed].map(async (response) => {
        expect(response.headers.get('set-cookie')).toBeNull();
        expect(response.headers.get('cache-control')).toBe('no-store');
        const body = (await response.json()) as { error: object };
        return [response.status, body.error];
      }),
    );
    expect(responses).toEqual(
      responses.map(() => [
        401,
        { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
      ]),
    );
  });

  it('requires exact Origin and valid proof on every mutation without credentialed CORS', async () => {
    const agent = await browser();
    const data = { email, password };
    for (const path of ['login', 'logout', 'forgot-password', 'reset-password']) {
      for (const candidate of ['', 'null', 'http://tenant.example.test'])
        expect((await post(path, data, agent, { Origin: candidate })).status).toBe(403);
      expect((await post(path, data)).status).toBe(403);
    }
    const spoofedHost = await new Promise<number | undefined>((resolve, reject) => {
      const request = rawRequest(
        `${origin}/api/v1/auth/login`,
        {
          method: 'POST',
          headers: {
            Host: 'admin.example.test',
            Origin: origin,
            'Content-Type': 'application/json',
            Cookie: agent.cookies,
            'X-CSRF-Token': agent.csrf,
          },
        },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      );
      request.on('error', reject).end(JSON.stringify(data));
    });
    expect(spoofedHost).toBe(400);
    expect((await http('csrf')).status).toBe(403);
    const preflight = await http('login', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://tenant.example.test',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'x-csrf-token',
      },
    });
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
    expect(preflight.headers.get('access-control-allow-credentials')).toBeNull();
    expect((await post('login', { ...data, tenantId: 'untrusted-sentinel' }, agent)).status).toBe(
      400,
    );
    expect(
      (
        await http('me', {
          headers: {
            Cookie: 'sportify_session_dev=' + secret() + '; sportify_session_dev=' + secret(),
          },
        })
      ).status,
    ).toBe(400);
  });

  it('fails closed on database errors and sets no login cookie when commit fails', async () => {
    const agent = await browser();
    loginCommitFails = true;
    const failed = await post('login', { email, password }, agent);
    expect(failed.status).toBe(503);
    expect(failed.headers.get('set-cookie')).toBeNull();
    loginCommitFails = false;
    const a = await login();
    const bound = await browser(a.pair);
    unavailable = true;
    const denied = await http('me', { headers: { Cookie: a.pair } });
    expect(denied.status).toBe(503);
    const logout = await post('logout', {}, bound);
    expect(logout.status).toBe(503);
    expect(logout.headers.getSetCookie()[0]).toMatch(/^sportify_session_dev=;/);
    expect(JSON.stringify(logs.mock.calls)).not.toContain(a.token);
    expect(JSON.stringify(logs.mock.calls)).not.toContain(password);
  });

  it('uses generic reset acknowledgements and rejects an unusable token and GET confirmation', async () => {
    const agent = await browser();
    const existing = await post('forgot-password', { email }, agent);
    const nonexistent = await post('forgot-password', { email: 'missing@example.test' }, agent);
    for (const response of [existing, nonexistent]) {
      expect(response.status).toBe(202);
      expect(await response.json()).toMatchObject({ data: { status: 'accepted' } });
      expect(response.headers.get('set-cookie')).toBeNull();
    }
    const input = { token: secret(), password: passwordNext };
    expect((await http('reset-password')).status).toBe(404);
    expect((await post('reset-password', input, agent)).status).toBe(400);
    const outbox = execute.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO SPORTIFY_SCHEMA_OWNER.OUTBOX_EVENTS'),
    );
    const revoke = execute.mock.calls.findIndex(([sql]) =>
      sql.includes(
        'UPDATE SPORTIFY_SCHEMA_OWNER.PASSWORD_RESET_TOKENS SET REVOKED_AT_UTC=LOCALTIMESTAMP',
      ),
    );
    const issuance = execute.mock.calls.findIndex(([sql]) =>
      sql.includes('INSERT INTO SPORTIFY_SCHEMA_OWNER.PASSWORD_RESET_TOKENS'),
    );
    expect(revoke).toBeGreaterThanOrEqual(0);
    expect(issuance).toBeGreaterThan(revoke);
    const reference = JSON.parse(String(outbox?.[1]?.payload)) as { tokenId?: string };
    expect(reference.tokenId).toMatch(/^[0-9a-f-]{36}$/);
    expect(reference).toEqual({ tokenId: reference.tokenId, keyVersion: 'r1' });
  });

  it('confirms one reset using digest-only storage, emits safe intent and requires a new login', async () => {
    const prior = await login();
    const priorOther = await login();
    const browserBeforeReset = await browser(prior.pair);
    const token = secret();
    resetDigest = tokenDigest(token);
    const result = await post(
      'reset-password',
      { token, password: passwordNext },
      browserBeforeReset,
    );
    expect(result.status).toBe(200);
    expect(result.headers.get('set-cookie')).toBeNull();
    expect(await result.json()).toMatchObject({ data: { status: 'reset' } });
    for (const { pair } of [prior, priorOther])
      expect((await http('me', { headers: { Cookie: pair } })).status).toBe(401);
    expect(
      (await post('reset-password', { token, password: passwordNext }, browserBeforeReset)).status,
    ).toBe(400);
    expect((await post('login', { email, password }, await browser())).status).toBe(401);
    expect((await post('login', { email, password: passwordNext }, await browser())).status).toBe(
      200,
    );
    const completion = execute.mock.calls.find(
      ([, binds]) => binds?.eventType === 'auth.password-reset.completed',
    );
    expect(completion?.[1]?.payload).toBe(JSON.stringify({ userId: identity.PUBLIC_ID }));
    const observed = JSON.stringify(execute.mock.calls);
    expect(observed).not.toContain(token);
    expect(observed).not.toContain(passwordNext);
    expect(observed).toContain(tokenDigest(token));
  });
});
