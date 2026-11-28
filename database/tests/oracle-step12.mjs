import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import oracledb from 'oracledb';
import { createDatabase } from '@sportify/database';
import {
  loadManifest,
  migrateSession,
  parseMigrationConfig,
  verifySession,
  withOwnerSession,
} from '@sportify/migrations';
import { registrationGrants } from '../provisioning/step11-runtime-grants.mjs';
import { accountGrants } from '../provisioning/step12-runtime-grants.mjs';
import { runtimeVerificationConfigs } from './support/runtime-privileges.mjs';
import { observedPoolFactory } from './step10/pool-observer.mjs';
import application from '../../apps/api/dist/application.js';
import password from '../../apps/api/dist/modules/auth/password.js';
import { parseSessionConfig } from '../../apps/api/dist/modules/auth/session-config.js';
import delivery from '../../packages/verification-email/dist/index.js';

const owner = 'SPORTIFY_STEP12_TEST_OWNER';
const target = 'fce953xa';
const mailSuffix = '@step12.example.test';
const scope = [...registrationGrants, ...accountGrants];
const fixtureTables = [
  'OUTBOX_EVENTS',
  'AUDIT_LOGS',
  'AUTH_SESSIONS',
  'PASSWORD_RESET_TOKENS',
  'EMAIL_VERIFICATION_TOKENS',
  'AUTH_SOURCE_WINDOWS',
  'USER_ROLES',
  'ROLES',
  'TENANT_USERS',
  'TENANTS',
  'USERS',
];
const redacted = (error) => ({
  code: /^[A-Z][A-Z_]+$/.test(error?.code ?? '') ? error.code : null,
  oracle: Number.isInteger(error?.errorNum) ? error.errorNum : null,
  driver: /^(?:NJS|DPI)-\d+$/.test(error?.code ?? '') ? error.code : null,
  line: Number(error?.stack?.match(/oracle-step12\.mjs:(\d+):\d+/)?.[1]) || null,
});
const report = (check, evidence = {}) =>
  console.log(JSON.stringify({ event: 'step12.oracle', result: 'PASS', check, ...evidence }));
let phase = 'prerequisites';

function deferred() {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function bounded(promise) {
  const clock = new AbortController();
  try {
    return await Promise.race([
      promise,
      delay(12000, undefined, { signal: clock.signal }).then(() => {
        throw new Error('Live coordination timed out.');
      }),
    ]);
  } finally {
    clock.abort();
  }
}

function racePair() {
  const ready = deferred();
  const sessions = new Set();
  const arrive = async (sessionId) => {
    assert.ok(sessionId && !sessions.has(sessionId));
    sessions.add(sessionId);
    if (sessions.size === 2) ready.release();
    await bounded(ready.promise);
  };
  return { arrive, sessions };
}

async function localMailSink() {
  const captured = [];
  const sink = createServer(async (request, response) => {
    const chunks = [];
    for await (const part of request) chunks.push(part);
    captured.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    response.writeHead(204).end();
  });
  await new Promise((resolve, reject) => {
    sink.once('error', reject);
    sink.listen(0, '127.0.0.1', resolve);
  });
  const port = sink.address().port;
  return {
    captured,
    send: async (mail, signal) => {
      const response = await fetch('http://127.0.0.1:' + port, {
        method: 'POST',
        body: JSON.stringify(mail),
        headers: { 'content-type': 'application/json' },
        signal,
      });
      assert.equal(response.status, 204);
    },
    close: () =>
      new Promise((resolve, reject) => sink.close((error) => (error ? reject(error) : resolve()))),
  };
}

function queries(session) {
  const execute = (sql, binds = {}) =>
    session.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const rows = async (sql, binds) => (await execute(sql, binds)).rows;
  const count = async (table, predicate = '', binds) =>
    (await rows('SELECT COUNT(*) AS N FROM ' + table + ' ' + predicate, binds))[0].N;
  return { execute, rows, count };
}

async function assertClean(db) {
  const totals = await db.rows(
    'SELECT ' +
      fixtureTables.map((table) => '(SELECT COUNT(*) FROM ' + table + ') AS ' + table).join(',') +
      ' FROM DUAL',
  );
  assert.ok(Object.values(totals[0]).every((total) => total === 0));
  for (const view of ['USER_TAB_PRIVS_MADE', 'USER_COL_PRIVS_MADE'])
    assert.equal(await db.count(view, "WHERE GRANTEE IN ('SPORTIFY_API','SPORTIFY_WORKER')"), 0);
}

async function applyTestGrants(db) {
  for (const [grantee, object, privilege, columns] of scope)
    await db.execute(
      'GRANT ' +
        privilege +
        (columns ? ' (' + columns + ')' : '') +
        ' ON ' +
        owner +
        '.' +
        object +
        ' TO ' +
        grantee,
    );
  const objects = scope
    .filter((entry) => !entry[3])
    .map(([grantee, object, privilege]) => [grantee, object, privilege, 'NO']);
  const columns = scope
    .filter((entry) => entry[3])
    .flatMap(([grantee, object, privilege, list]) =>
      list.split(',').map((column) => [grantee, object, column, privilege, 'NO']),
    );
  const sorted = (entries) => entries.map((values) => JSON.stringify(values)).sort();
  const actual = (view, fields) =>
    db.rows(
      'SELECT ' + fields + ' FROM ' + view + " WHERE GRANTEE IN ('SPORTIFY_API','SPORTIFY_WORKER')",
    );
  assert.deepEqual(
    sorted(
      (await actual('USER_TAB_PRIVS_MADE', 'GRANTEE,TABLE_NAME,PRIVILEGE,GRANTABLE')).map(
        Object.values,
      ),
    ),
    sorted(objects),
  );
  assert.deepEqual(
    sorted(
      (
        await actual('USER_COL_PRIVS_MADE', 'GRANTEE,TABLE_NAME,COLUMN_NAME,PRIVILEGE,GRANTABLE')
      ).map(Object.values),
    ),
    sorted(columns),
  );
}

async function cleanup(session, db) {
  assert.equal(
    await db.count('USERS', 'WHERE EMAIL_NORMALIZED NOT LIKE :suffix OR EMAIL_NORMALIZED IS NULL', {
      suffix: '%' + mailSuffix,
    }),
    0,
  );
  assert.equal(
    await db.count('TENANTS', "WHERE TENANT_NAME NOT LIKE 'Step 12 isolated fixture %'"),
    0,
  );
  for (const table of fixtureTables) await db.execute('DELETE FROM ' + table);
  await session.commit();
  for (const [grantee, object, privilege] of [...scope].reverse()) {
    try {
      await db.execute('REVOKE ' + privilege + ' ON ' + owner + '.' + object + ' FROM ' + grantee);
    } catch (error) {
      if (error.errorNum !== 1927) throw error;
    }
  }
  await assertClean(db);
}

async function seedAccount(db, suffix, hash, status, verified, membership = true) {
  const name = 'Step 12 isolated fixture ' + suffix;
  const email = suffix + mailSuffix;
  const publicId = randomUUID();
  await db.execute(
    `INSERT INTO USERS (PUBLIC_ID,FULL_NAME,EMAIL,EMAIL_NORMALIZED,PASSWORD_HASH,ACCOUNT_STATUS,EMAIL_VERIFIED_AT_UTC)
     VALUES (:publicId,:name,:email,:email,:encoded,:status,CASE WHEN :verified='Y' THEN LOCALTIMESTAMP ELSE NULL END)`,
    { publicId, name, email, encoded: hash, status, verified: verified ? 'Y' : 'N' },
  );
  const accountId = (
    await db.rows('SELECT TO_CHAR(USER_ID) AS ID FROM USERS WHERE PUBLIC_ID=:publicId', {
      publicId,
    })
  )[0].ID;
  if (membership) {
    const tenant = randomUUID();
    await db.execute(
      "INSERT INTO TENANTS (PUBLIC_ID,TENANT_CODE,TENANT_NAME,STATUS) VALUES (:id,:id,:name,'PENDING_ONBOARDING')",
      { id: tenant, name },
    );
    await db.execute(
      "INSERT INTO TENANT_USERS (TENANT_ID,USER_ID,PUBLIC_ID,MEMBERSHIP_STATUS) SELECT TENANT_ID,:accountId,:member,'ACTIVE' FROM TENANTS WHERE PUBLIC_ID=:tenant",
      { accountId, member: randomUUID(), tenant },
    );
  }
  return { accountId, email, publicId, name };
}

async function testWorkflows(session, db, config, runtimes) {
  const apiPool = observedPoolFactory();
  const workerPool = observedPoolFactory();
  const api = await createDatabase(
    { ...runtimes[0].config, ORACLE_POOL_MAX: 3 },
    'api',
    apiPool.factory,
  );
  let worker;
  let app;
  let mail;
  let hook;
  let injectResetFailure = false;
  let injectLogoutFailure = false;
  let closeFailed = false;
  const held = deferred();
  const logs = [];
  const evidence = [];
  const failures = [];
  const observe = async (work) => {
    try {
      return await work();
    } catch (error) {
      if (failures.length < 14) failures.push(redacted(error));
      throw error;
    }
  };
  try {
    phase = 'runtime-identity-and-privileges';
    worker = await createDatabase(runtimes[1].config, 'worker', workerPool.factory);
    const connection =
      "SELECT SYS_CONTEXT('USERENV','SESSION_USER') AS IDENTITY,SYS_CONTEXT('USERENV','DB_UNIQUE_NAME') AS TARGET FROM DUAL";
    for (const [role, database] of [
      ['API', api],
      ['WORKER', worker],
    ]) {
      assert.deepEqual((await database.query(connection)).rows, [
        { IDENTITY: 'SPORTIFY_' + role, TARGET: target },
      ]);
      assert.deepEqual((await database.query('SELECT PRIVILEGE FROM SESSION_PRIVS')).rows, [
        { PRIVILEGE: 'CREATE SESSION' },
      ]);
      assert.deepEqual((await database.query('SELECT ROLE FROM SESSION_ROLES')).rows, []);
    }
    const denied = (database, table) =>
      assert.rejects(
        () => database.query('SELECT 1 FROM ' + owner + '.' + table + ' WHERE 1=0'),
        (error) => [942, 1031, 41900].includes(error?.errorNum),
      );
    await denied(api, 'AUTH_SESSIONS');
    await denied(api, 'VW_AUTH_PASSWORD_RESET_MAIL');
    for (const table of [
      'USERS',
      'PASSWORD_RESET_TOKENS',
      'AUTH_SESSIONS',
      'VW_AUTH_DASHBOARD_SESSIONS',
      'AUDIT_LOGS',
      'OUTBOX_EVENTS',
    ])
      await denied(worker, table);
    report('runtime-privileges', { denialProbes: 8 });

    phase = 'fixture-and-api';
    const firstPass = '  Step12 synthetic current passphrase  ';
    const nextPass = 'Step12 synthetic replacement passphrase';
    const encode = password.createPasswordEncoder(config.passwordBlocklist);
    const originalHash = await encode(firstPass);
    const active = await seedAccount(db, 'active', originalHash, 'ACTIVE', true);
    const pending = await seedAccount(db, 'pending', null, 'PENDING', false, false);
    const disabled = await seedAccount(db, 'disabled', originalHash, 'DISABLED', true);
    const unverified = await seedAccount(db, 'unverified', originalHash, 'ACTIVE', false);
    const noMembership = await seedAccount(
      db,
      'identity-only',
      originalHash,
      'ACTIVE',
      true,
      false,
    );
    await db.execute(
      `INSERT INTO ROLES (TENANT_ID,ROLE_CODE,ROLE_NAME,IS_SYSTEM_ROLE,IS_ACTIVE)
       SELECT TENANT_ID,'BUSINESS_OWNER','Test owner','Y','Y' FROM TENANT_USERS WHERE USER_ID=:accountId`,
      { accountId: active.accountId },
    );
    await db.execute(
      `INSERT INTO USER_ROLES (TENANT_ID,MEMBERSHIP_ID,ROLE_ID)
       SELECT m.TENANT_ID,m.MEMBERSHIP_ID,r.ROLE_ID FROM TENANT_USERS m JOIN ROLES r ON r.TENANT_ID=m.TENANT_ID
       WHERE m.USER_ID=:accountId AND r.ROLE_CODE='BUSINESS_OWNER'`,
      { accountId: active.accountId },
    );
    const key = config.resetKeys.get(config.resetKeyVersion);
    const verificationToken = delivery.deriveVerificationToken(
      {
        tokenId: randomUUID(),
        keyVersion: 'v1',
        userId: active.publicId,
        expiresAt: '2026-11-28T12:00:00.010000',
      },
      key,
    );
    await db.execute(
      "INSERT INTO EMAIL_VERIFICATION_TOKENS (USER_ID,PUBLIC_ID,TOKEN_KEY_VERSION,TOKEN_HASH,EXPIRES_AT_UTC) VALUES (:accountId,:id,'v1',:digest,LOCALTIMESTAMP+INTERVAL '15' MINUTE)",
      {
        accountId: active.accountId,
        id: randomUUID(),
        digest: delivery.tokenDigest(verificationToken),
      },
    );
    // An admin-audience fixture cannot be read or used by the dashboard, but reset must revoke it.
    const adminToken = randomBytes(32).toString('base64url');
    await db.execute(
      "INSERT INTO AUTH_SESSIONS (USER_ID,TOKEN_HASH,EXPIRES_AT_UTC,AUDIENCE) VALUES (:accountId,:digest,LOCALTIMESTAMP+INTERVAL '1' HOUR,'ADMIN')",
      { accountId: active.accountId, digest: delivery.tokenDigest(adminToken) },
    );
    await session.commit();
    mail = await localMailSink();
    const deliver = delivery.createPasswordResetDelivery({
      database: worker,
      owner,
      origin: 'https://app.example.test',
      keys: config.resetKeys,
      send: mail.send,
      report: (value) => evidence.push(value),
    });
    const instrumented = {
      ...api,
      query: (sql, binds) => observe(() => api.query(sql, binds)),
      transaction: (work) =>
        observe(() =>
          api.transaction((connection) =>
            work({
              async execute(sql, binds) {
                if (hook) await hook(connection, sql);
                if (injectResetFailure && binds?.eventType === 'auth.password-reset.completed')
                  await connection.execute(
                    "BEGIN RAISE_APPLICATION_ERROR(-20082,'Isolated reset fixture'); END;",
                  );
                if (injectLogoutFailure && binds?.action === 'auth.logout.succeeded')
                  await connection.execute(
                    "BEGIN RAISE_APPLICATION_ERROR(-20083,'Isolated logout fixture'); END;",
                  );
                return connection.execute(sql, binds);
              },
            }),
          ),
        ),
    };
    app = await application.createApiApplication(
      { NODE_ENV: 'test', PORT: 4000, database: runtimes[0].config, account: config },
      (event) => logs.push(event),
      () => Promise.resolve(instrumented),
      undefined,
      owner,
    );
    await app.listen(0, '127.0.0.1');
    const origin = await app.getUrl();
    config.dashboardOrigin.port = new URL(origin).port;
    const authPath = origin + '/api/v1/auth/';
    const request = (path, init = {}) =>
      fetch(authPath + path, { ...init, signal: AbortSignal.timeout(25000) });
    async function agent(sessionCookie = '') {
      const response = await request('csrf', {
        headers: { cookie: sessionCookie, 'x-csrf-bootstrap': '1' },
      });
      assert.equal(response.status, 200);
      const csrfCookie = response.headers.getSetCookie()[0].split(';')[0];
      const csrf = (await response.json()).data.csrfToken;
      return { csrf, cookie: [sessionCookie, csrfCookie].filter(Boolean).join('; ') };
    }
    async function post(path, body, browser) {
      const response = await request(path, {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/json',
          cookie: browser.cookie,
          'x-csrf-token': browser.csrf,
        },
        body: JSON.stringify(body),
      });
      const payload = response.status === 204 ? null : await response.json();
      if (payload) assert.equal(payload.requestId, response.headers.get('x-request-id'));
      assert.equal(response.headers.get('cache-control'), 'no-store');
      return { status: response.status, payload, cookies: response.headers.getSetCookie() };
    }
    async function login(pass = firstPass, email = active.email) {
      return post('login', { email, password: pass }, await agent());
    }
    function sessionCookie(result) {
      assert.equal(result.status, 200);
      assert.equal(result.cookies.length, 1);
      return result.cookies[0].split(';')[0];
    }
    const me = async (cookie) => (await request('me', { headers: { cookie } })).status;
    const digest = (cookie) => delivery.tokenDigest(cookie.split('=')[1]);
    const lockSql = 'SELECT USER_ID FROM ' + owner + '.USERS WHERE USER_ID=:accountId FOR UPDATE';
    const sessionId = async (connection) =>
      (await connection.execute("SELECT SYS_CONTEXT('USERENV','SID') AS SID FROM DUAL")).rows[0]
        .SID;

    phase = 'login-logout-touch-and-expiry';
    const bad = await login('wrong synthetic password');
    for (const address of [
      'unknown' + mailSuffix,
      disabled.email,
      pending.email,
      unverified.email,
      noMembership.email,
    ]) {
      const rejected = await login(firstPass, address);
      assert.equal(rejected.status, 401);
      assert.deepEqual(rejected.payload.error, bad.payload.error);
    }
    assert.equal(bad.status, 401);
    const ownerLogin = await login();
    const first = sessionCookie(ownerLogin);
    assert.deepEqual(ownerLogin.payload.data, {
      account: { publicId: active.publicId, fullName: active.name, emailVerified: true },
    });
    assert.equal(
      await db.count('TENANTS', "WHERE STATUS='PENDING_ONBOARDING'"),
      await db.count('TENANTS'),
    );
    assert.equal(await db.count('SUBSCRIPTIONS'), 0);
    const firstToken = first.split('=')[1];
    assert.match(firstToken, delivery.tokenPattern);
    assert.equal(
      await db.count(
        'AUTH_SESSIONS',
        `WHERE TOKEN_HASH=:digest AND AUDIENCE='DASHBOARD' AND ACTIVE_TENANT_ID IS NULL AND ACTIVE_MEMBERSHIP_ID IS NULL
       AND EXPIRES_AT_UTC BETWEEN CREATED_AT_UTC+NUMTODSINTERVAL(43199,'SECOND') AND CREATED_AT_UTC+NUMTODSINTERVAL(43201,'SECOND')
       AND IDLE_EXPIRES_AT_UTC BETWEEN CREATED_AT_UTC+NUMTODSINTERVAL(1799,'SECOND') AND CREATED_AT_UTC+NUMTODSINTERVAL(1801,'SECOND')`,
        { digest: digest(first) },
      ),
      1,
    );
    assert.equal(
      await db.count('AUTH_SESSIONS', 'WHERE TOKEN_HASH=:rawToken', { rawToken: firstToken }),
      0,
    );
    const second = sessionCookie(await login());
    const third = sessionCookie(await login());
    assert.notEqual(first, second);
    assert.equal(await me(first), 200);
    assert.equal(await me('sportify_session_dev=' + adminToken), 401);
    injectLogoutFailure = true;
    const failedLogout = await post('logout', {}, await agent(first));
    injectLogoutFailure = false;
    assert.equal(failedLogout.status, 500);
    assert.equal(failedLogout.payload.error.code, 'INTERNAL_ERROR');
    assert.equal(failedLogout.cookies[0]?.split(';')[0], 'sportify_session_dev=');
    assert.ok(failures.some(({ oracle }) => oracle === 20083));
    assert.equal(await me(first), 200);
    assert.equal(apiPool.state.pool.connectionsInUse, 0);
    const logout = await post('logout', {}, await agent(first));
    assert.equal(logout.status, 204);
    assert.ok(logout.cookies[0].startsWith('sportify_session_dev=;'));
    assert.equal(await me(first), 401);
    assert.equal(await me(second), 200);
    assert.equal((await post('logout', {}, await agent(first))).status, 204);

    await db.execute(
      "UPDATE AUTH_SESSIONS SET LAST_SEEN_AT_UTC=LOCALTIMESTAMP-INTERVAL '2' MINUTE,IDLE_EXPIRES_AT_UTC=LOCALTIMESTAMP+INTERVAL '10' SECOND WHERE TOKEN_HASH=:digest",
      { digest: digest(second) },
    );
    await session.commit();
    assert.equal(await me(second), 200);
    assert.equal(
      await db.count(
        'AUTH_SESSIONS',
        "WHERE TOKEN_HASH=:digest AND IDLE_EXPIRES_AT_UTC>LOCALTIMESTAMP+INTERVAL '1' MINUTE AND IDLE_EXPIRES_AT_UTC<=EXPIRES_AT_UTC",
        { digest: digest(second) },
      ),
      1,
    );
    const readTouch = () =>
      db.rows(
        "SELECT TO_CHAR(LAST_SEEN_AT_UTC,'YYYY-MM-DD HH24:MI:SS.FF6') AS SEEN FROM AUTH_SESSIONS WHERE TOKEN_HASH=:digest",
        { digest: digest(second) },
      );
    const afterTouch = await readTouch();
    assert.equal(await me(second), 200);
    assert.deepEqual(await readTouch(), afterTouch);
    await db.execute(
      "UPDATE AUTH_SESSIONS SET CREATED_AT_UTC=LOCALTIMESTAMP-INTERVAL '1' HOUR,EXPIRES_AT_UTC=LOCALTIMESTAMP-INTERVAL '1' SECOND,IDLE_EXPIRES_AT_UTC=LOCALTIMESTAMP-INTERVAL '2' SECOND WHERE TOKEN_HASH=:digest",
      { digest: digest(third) },
    );
    const idleExpired = sessionCookie(await login());
    await db.execute(
      "UPDATE AUTH_SESSIONS SET CREATED_AT_UTC=LOCALTIMESTAMP-INTERVAL '1' HOUR,IDLE_EXPIRES_AT_UTC=LOCALTIMESTAMP-INTERVAL '1' SECOND,LAST_SEEN_AT_UTC=LOCALTIMESTAMP-INTERVAL '5' MINUTE WHERE TOKEN_HASH=:digest",
      { digest: digest(idleExpired) },
    );
    await session.commit();
    assert.equal(await me(third), 401);
    assert.equal(await me(idleExpired), 401);
    assert.equal(
      await db.count(
        'AUTH_SESSIONS',
        'WHERE TOKEN_HASH=:digest AND IDLE_EXPIRES_AT_UTC<=LOCALTIMESTAMP',
        { digest: digest(idleExpired) },
      ),
      1,
    );
    report('session-identity-device-logout-idle-and-absolute-expiry');

    phase = 'session-touch-versus-revocation';
    const touchCookie = sessionCookie(await login());
    await db.execute(
      "UPDATE AUTH_SESSIONS SET LAST_SEEN_AT_UTC=LOCALTIMESTAMP-INTERVAL '2' MINUTE WHERE TOKEN_HASH=:digest",
      { digest: digest(touchCookie) },
    );
    await session.commit();
    const touchClock = () =>
      db.rows(
        "SELECT TO_CHAR(LAST_SEEN_AT_UTC,'YYYY-MM-DD HH24:MI:SS.FF6') AS SEEN,TO_CHAR(IDLE_EXPIRES_AT_UTC,'YYYY-MM-DD HH24:MI:SS.FF6') AS DEADLINE FROM AUTH_SESSIONS WHERE TOKEN_HASH=:digest",
        { digest: digest(touchCookie) },
      );
    const beforeRevoke = await touchClock();
    const touchReady = deferred();
    const resumeTouch = deferred();
    let touchSid;
    hook = async (connection, sql) => {
      if (sql.startsWith('UPDATE ' + owner + '.VW_AUTH_DASHBOARD_SESSIONS s SET')) {
        touchSid = await sessionId(connection);
        touchReady.release();
        await bounded(resumeTouch.promise);
      }
      if (sql.includes("REVOKE_REASON='LOGOUT'"))
        assert.notEqual(await sessionId(connection), touchSid);
    };
    const touching = me(touchCookie);
    try {
      assert.equal(
        await bounded(
          Promise.race([touchReady.promise.then(() => true), touching.then(() => false)]),
        ),
        true,
      );
      assert.equal((await post('logout', {}, await agent(touchCookie))).status, 204);
    } finally {
      resumeTouch.release();
      hook = undefined;
    }
    assert.equal(await touching, 401);
    assert.deepEqual(await touchClock(), beforeRevoke);
    assert.equal(
      await db.count('AUTH_SESSIONS', "WHERE TOKEN_HASH=:digest AND REVOKE_REASON='LOGOUT'", {
        digest: digest(touchCookie),
      }),
      1,
    );
    assert.equal(apiPool.state.pool.connectionsInUse, 0);
    report('session-touch-revocation-interleaving', { coordinatedSessions: 2 });

    phase = 'reset-issuance-and-controlled-delivery';
    const browser = await agent();
    assert.equal(
      (await post('reset-password', { token: verificationToken, password: nextPass }, browser))
        .status,
      400,
    );
    const issue = async (email = active.email) => post('forgot-password', { email }, browser);
    const issuePair = racePair();
    const issueLock =
      'SELECT USER_ID FROM ' + owner + '.USERS WHERE EMAIL_NORMALIZED=:email FOR UPDATE';
    hook = async (connection, sql) => {
      if (sql === issueLock) await issuePair.arrive(await sessionId(connection));
    };
    const duplicate = await Promise.all([issue(), issue()]);
    hook = undefined;
    assert.deepEqual(
      duplicate.map((result) => result.status),
      [202, 202],
    );
    assert.equal(issuePair.sessions.size, 2);
    const unknown = await issue('unknown' + mailSuffix);
    assert.deepEqual(unknown.payload.data, duplicate[0].payload.data);
    assert.equal(await db.count('PASSWORD_RESET_TOKENS'), 1);
    assert.equal(await me(second), 200);
    const refs = async () =>
      (
        await db.rows(
          "SELECT JSON_VALUE(PAYLOAD,'$.tokenId') AS TOKEN_ID, JSON_VALUE(PAYLOAD,'$.keyVersion') AS KEY_VERSION FROM OUTBOX_EVENTS WHERE EVENT_TYPE='auth.password-reset.requested' ORDER BY OUTBOX_EVENT_ID",
        )
      ).map(({ TOKEN_ID, KEY_VERSION }) => ({ tokenId: TOKEN_ID, keyVersion: KEY_VERSION }));
    const [firstRef] = await refs();
    assert.equal(
      await db.count(
        'PASSWORD_RESET_TOKENS',
        "WHERE PUBLIC_ID=:id AND EXPIRES_AT_UTC BETWEEN CREATED_AT_UTC+NUMTODSINTERVAL(1799,'SECOND') AND CREATED_AT_UTC+NUMTODSINTERVAL(1801,'SECOND')",
        { id: firstRef.tokenId },
      ),
      1,
    );
    const capture = async (reference) => {
      assert.equal(await deliver(reference), 'sent');
      const lastMail = mail.captured.at(-1);
      assert.equal(lastMail.to, active.email);
      const link = new URL(lastMail.text.match(/https:\/\/[^\s]+/u)[0]);
      assert.equal(link.origin, 'https://app.example.test');
      assert.equal(link.pathname, '/reset-password');
      assert.equal(link.search, '');
      const token = new URLSearchParams(link.hash.slice(1)).get('token');
      assert.match(token, delivery.tokenPattern);
      return token;
    };
    const firstResetToken = await capture(firstRef);
    const ageIssuance = () =>
      db.execute(
        "UPDATE PASSWORD_RESET_TOKENS SET CREATED_AT_UTC=LOCALTIMESTAMP-INTERVAL '2' MINUTE",
      );
    await ageIssuance();
    await session.commit();
    const confirmationReady = deferred();
    const releaseConfirmation = deferred();
    let confirmationSid;
    hook = async (connection, sql) => {
      if (sql === lockSql) {
        confirmationSid = await sessionId(connection);
        confirmationReady.release();
        await bounded(releaseConfirmation.promise);
      }
      if (sql === issueLock) assert.notEqual(await sessionId(connection), confirmationSid);
    };
    const staleReset = post(
      'reset-password',
      { token: firstResetToken, password: nextPass },
      browser,
    );
    try {
      assert.equal(
        await bounded(
          Promise.race([confirmationReady.promise.then(() => true), staleReset.then(() => false)]),
        ),
        true,
      );
      assert.equal((await issue()).status, 202);
    } finally {
      releaseConfirmation.release();
      hook = undefined;
    }
    assert.equal((await staleReset).status, 400);
    assert.equal(await deliver(firstRef), 'ineligible');
    assert.equal(await me(second), 200);
    const [, secondRef] = await refs();
    await ageIssuance();
    await session.commit();
    assert.equal((await issue()).status, 202);
    const issuedRefs = await refs();
    assert.equal(issuedRefs.length, 3);
    await ageIssuance();
    await session.commit();
    assert.equal((await issue()).status, 202);
    assert.deepEqual(await refs(), issuedRefs);
    assert.equal(await deliver(secondRef), 'ineligible');
    const ref = issuedRefs[2];
    const token = await capture(ref);
    assert.equal(
      await db.count('PASSWORD_RESET_TOKENS', 'WHERE PUBLIC_ID=:id AND TOKEN_HASH=:digest', {
        id: ref.tokenId,
        digest: delivery.tokenDigest(token),
      }),
      1,
    );
    assert.equal((await request('reset-password')).status, 404);
    report('generic-reset-cooldown-account-cap-replacement-and-loopback-delivery', {
      competingSessions: 2,
    });

    phase = 'reset-rollback-and-races';
    const confirm = () => post('reset-password', { token, password: nextPass }, browser);
    // Model an outstanding link created before the replacement policy took effect.
    const priorId = randomUUID();
    await db.execute(
      `INSERT INTO PASSWORD_RESET_TOKENS (USER_ID,PUBLIC_ID,TOKEN_KEY_VERSION,TOKEN_HASH,CREATED_AT_UTC,EXPIRES_AT_UTC)
       VALUES (:accountId,:id,:keyVersion,:digest,LOCALTIMESTAMP-INTERVAL '16' MINUTE,LOCALTIMESTAMP+INTERVAL '10' MINUTE)`,
      {
        accountId: active.accountId,
        id: priorId,
        keyVersion: config.resetKeyVersion,
        digest: delivery.tokenDigest(randomBytes(32).toString('base64url')),
      },
    );
    await session.commit();
    injectResetFailure = true;
    const failedReset = await confirm();
    injectResetFailure = false;
    assert.equal(failedReset.status, 500);
    assert.equal(failedReset.payload.error.code, 'INTERNAL_ERROR');
    assert.ok(failures.some(({ oracle }) => oracle === 20082));
    assert.equal(apiPool.state.pool.connectionsInUse, 0);
    assert.equal(
      await db.count(
        'USERS',
        "WHERE USER_ID=:id AND PASSWORD_HASH=:originalHash AND ACCOUNT_STATUS='ACTIVE'",
        { id: active.accountId, originalHash },
      ),
      1,
    );
    assert.equal(
      await db.count(
        'PASSWORD_RESET_TOKENS',
        'WHERE PUBLIC_ID IN (:latestId,:olderId) AND CONSUMED_AT_UTC IS NULL AND REVOKED_AT_UTC IS NULL',
        { latestId: ref.tokenId, olderId: priorId },
      ),
      2,
    );
    assert.equal(
      await db.count('AUDIT_LOGS', "WHERE ACTION_CODE='auth.password-reset.completed'"),
      0,
    );
    assert.equal(
      await db.count('OUTBOX_EVENTS', "WHERE EVENT_TYPE='auth.password-reset.completed'"),
      0,
    );
    assert.equal(await me(second), 200);
    const oldRead = deferred();
    const pair = racePair();
    let loginSid;
    hook = async (connection, sql) => {
      if (sql !== lockSql) return;
      const sid = await sessionId(connection);
      if (!loginSid) {
        loginSid = sid;
        oldRead.release();
        await bounded(held.promise);
      } else {
        assert.notEqual(sid, loginSid);
        await pair.arrive(sid);
      }
    };
    const stale = login();
    const arrived = await bounded(
      Promise.race([oldRead.promise.then(() => true), stale.then(() => false)]),
    );
    assert.equal(arrived, true);
    try {
      const confirmation = await Promise.all([confirm(), confirm()]);
      assert.deepEqual(confirmation.map((entry) => entry.status).sort(), [200, 400]);
      assert.ok(confirmation.every((entry) => entry.cookies.length === 0));
      assert.equal(pair.sessions.size, 2);
    } finally {
      held.release();
      hook = undefined;
    }
    assert.equal((await stale).status, 401);
    assert.equal(await me(second), 401);
    assert.equal((await login()).status, 401);
    assert.equal((await login(nextPass)).status, 200);
    assert.equal((await confirm()).status, 400);
    assert.equal(await deliver(ref), 'ineligible');
    assert.equal(await deliver(firstRef), 'ineligible');
    assert.equal(
      await db.count(
        'PASSWORD_RESET_TOKENS',
        'WHERE PUBLIC_ID=:id AND REVOKED_AT_UTC IS NOT NULL AND CONSUMED_AT_UTC IS NULL',
        { id: priorId },
      ),
      1,
    );
    assert.equal(
      await db.count(
        'AUTH_SESSIONS',
        "WHERE TOKEN_HASH=:digest AND REVOKE_REASON='PASSWORD_RESET'",
        { digest: delivery.tokenDigest(adminToken) },
      ),
      1,
    );
    assert.equal(
      await db.count(
        'PASSWORD_RESET_TOKENS',
        'WHERE PUBLIC_ID=:id AND REVOKED_AT_UTC IS NOT NULL',
        { id: firstRef.tokenId },
      ),
      1,
    );
    assert.equal(
      await db.count(
        'USERS',
        "WHERE USER_ID=:id AND ACCOUNT_STATUS='ACTIVE' AND EMAIL_VERIFIED_AT_UTC IS NOT NULL",
        { id: active.accountId },
      ),
      1,
    );
    assert.equal(
      await db.count('TENANT_USERS', "WHERE USER_ID=:id AND MEMBERSHIP_STATUS='ACTIVE'", {
        id: active.accountId,
      }),
      1,
    );
    assert.equal(
      await db.count('AUDIT_LOGS', "WHERE ACTION_CODE='auth.password-reset.completed'"),
      1,
    );
    assert.equal(
      await db.count('OUTBOX_EVENTS', "WHERE EVENT_TYPE='auth.password-reset.completed'"),
      1,
    );
    const expired = randomBytes(32).toString('base64url');
    const expiredRef = { tokenId: randomUUID(), keyVersion: config.resetKeyVersion };
    await db.execute(
      `INSERT INTO PASSWORD_RESET_TOKENS (USER_ID,PUBLIC_ID,TOKEN_KEY_VERSION,TOKEN_HASH,CREATED_AT_UTC,EXPIRES_AT_UTC)
       VALUES (:accountId,:id,:keyVersion,:digest,LOCALTIMESTAMP-INTERVAL '1' HOUR,LOCALTIMESTAMP-INTERVAL '1' SECOND)`,
      {
        accountId: active.accountId,
        id: expiredRef.tokenId,
        keyVersion: expiredRef.keyVersion,
        digest: delivery.tokenDigest(expired),
      },
    );
    await session.commit();
    assert.equal(
      (await post('reset-password', { token: expired, password: nextPass }, browser)).status,
      400,
    );
    assert.equal(await deliver(expiredRef), 'ineligible');
    const safe = JSON.stringify({ logs, evidence });
    for (const sentinel of [
      token,
      expired,
      firstToken,
      firstResetToken,
      firstPass,
      nextPass,
      active.email,
      config.csrfKey.toString('base64url'),
    ])
      assert.ok(!safe.includes(sentinel));
    report('atomic-reset-rollback-confirm-race-stale-login-and-redaction', {
      coordinatedSessions: 3,
    });
  } catch (error) {
    console.error(
      JSON.stringify({ event: 'step12.workflow.failure', phase, failures, ...redacted(error) }),
    );
    throw error;
  } finally {
    held.release();
    const results = await Promise.allSettled([
      app?.close(),
      api.close(),
      worker?.close(),
      mail?.close(),
    ]);
    closeFailed = results.some((value) => value.status === 'rejected');
    if (closeFailed) console.error('Step 12 isolated resource cleanup failed.');
  }
  if (closeFailed) throw new Error('Failed to close an isolated resource.');
  assert.equal(apiPool.state.closed, 1);
  assert.equal(workerPool.state.closed, 1);
  report('runtime-pool-closure', { api: apiPool.state.closed, worker: workerPool.state.closed });
}

try {
  const missing = [
    'ORACLE_MIGRATION_PASSWORD',
    'ORACLE_WALLET_PASSWORD',
    'ORACLE_API_PASSWORD',
    'ORACLE_WORKER_PASSWORD',
  ].filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(JSON.stringify({ event: 'step12.oracle.prerequisites', missing }));
    throw new Error('Supply the protected isolated Oracle configuration.');
  }
  const mode = process.argv.slice(2);
  const resume = mode[0] === '--resume-after-install';
  assert.ok(mode.length === 0 || (mode.length === 1 && resume));
  const migration = parseMigrationConfig(process.env);
  assert.equal(migration.ORACLE_MIGRATION_SCHEMA, owner);
  assert.equal(migration.ORACLE_MIGRATION_USER, owner);
  assert.equal(migration.ORACLE_MIGRATION_DB_UNIQUE_NAME, target);
  assert.equal(process.env.ORACLE_MIGRATION_TEST_CONFIRM, 'isolated-disposable-empty');
  const manifest = await loadManifest(fileURLToPath(new URL('../', import.meta.url)));
  assert.deepEqual(
    manifest.migrations.map(({ version }) => version),
    Array.from({ length: 28 }, (_, index) => ('00000' + (index + 1)).slice(-6)),
  );
  const runtimes = runtimeVerificationConfigs(process.env);
  const folder = await mkdtemp(join(tmpdir(), 'sportify-step12-test-'));
  try {
    const corpus = join(folder, 'synthetic-corpus.txt');
    await writeFile(corpus, 'F'.repeat(40) + '\n');
    const key = () => randomBytes(32).toString('base64url');
    const config = parseSessionConfig(
      {
        AUTH_ACCOUNT_ENABLED: 'true',
        AUTH_DASHBOARD_ORIGIN: 'http://127.0.0.1',
        AUTH_ALLOW_LOOPBACK_HTTP: 'true',
        AUTH_CSRF_KEY: key(),
        AUTH_SOURCE_KEY: key(),
        AUTH_RESET_KEYS: JSON.stringify({ r1: key() }),
        AUTH_RESET_KEY_VERSION: 'r1',
        AUTH_PASSWORD_BLOCKLIST_PATH: corpus,
        AUTH_RESET_OUTBOX_MAX_ATTEMPTS: '2',
        AUTH_LOGIN_PAIR_LIMIT: '25',
        AUTH_SESSION_SOURCE_LIMIT: '80',
      },
      'test',
    );
    await withOwnerSession(migration, async (session) => {
      const db = queries(session);
      phase = 'disposable-owner-catalog';
      assert.deepEqual(
        (await db.rows('SELECT PRIVILEGE FROM USER_SYS_PRIVS ORDER BY PRIVILEGE')).map(
          ({ PRIVILEGE }) => PRIVILEGE,
        ),
        ['CREATE SEQUENCE', 'CREATE SESSION', 'CREATE TABLE', 'CREATE VIEW'],
      );
      assert.deepEqual(
        await db.rows("SELECT PRIVILEGE FROM USER_SYS_PRIVS WHERE ADMIN_OPTION <> 'NO'"),
        [],
      );
      assert.deepEqual(await db.rows('SELECT GRANTED_ROLE FROM USER_ROLE_PRIVS'), []);
      const quotas = await db.rows(
        'SELECT TABLESPACE_NAME, MAX_BYTES FROM USER_TS_QUOTAS WHERE MAX_BYTES<>0',
      );
      assert.equal(quotas.length, 1);
      assert.equal(quotas[0].TABLESPACE_NAME, 'DATA');
      assert.ok(quotas[0].MAX_BYTES >= 1048576 && quotas[0].MAX_BYTES <= 268435456);
      if (resume) await verifySession(session, owner, manifest);
      else {
        assert.equal(await db.count('USER_OBJECTS'), 0);
        assert.equal((await migrateSession(session, owner, manifest)).length, 28);
        await verifySession(session, owner, manifest);
      }
      assert.deepEqual(await migrateSession(session, owner, manifest), []);
      assert.deepEqual(
        (await db.rows('SELECT VIEW_NAME,READ_ONLY FROM USER_VIEWS ORDER BY VIEW_NAME')).map(
          Object.values,
        ),
        [
          ['VW_AUTH_DASHBOARD_SESSIONS', 'N'],
          ['VW_AUTH_PASSWORD_RESET_MAIL', 'Y'],
          ['VW_AUTH_SESSION_REVOCATION', 'N'],
          ['VW_AUTH_VERIFICATION_MAIL', 'Y'],
        ],
      );
      await assertClean(db);
      report('migration-catalog-and-empty-fixtures', { applied: 28 });
      try {
        phase = 'disposable-grants';
        await applyTestGrants(db);
        await testWorkflows(session, db, config, runtimes);
      } finally {
        const previous = phase;
        phase = 'disposable-cleanup';
        await cleanup(session, db);
        report('fixture-and-grant-cleanup');
        phase = previous;
      }
    });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
} catch (error) {
  console.error(
    JSON.stringify({ event: 'step12.oracle', result: 'STOP', phase, ...redacted(error) }),
  );
  process.exitCode = 1;
}
