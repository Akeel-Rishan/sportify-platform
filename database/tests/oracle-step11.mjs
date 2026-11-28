import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm, rmdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import oracledb from 'oracledb';
import { createDatabase } from '@sportify/database';
import {
  loadManifest,
  migrateSession,
  parseMigrationConfig,
  verifySession,
  withOwnerSession,
} from '@sportify/migrations';
import {
  grantRegistration,
  revokeDisposableRegistration,
} from '../provisioning/step11-runtime-grants.mjs';
import { runtimeVerificationConfigs } from './support/runtime-privileges.mjs';
import application from '../../apps/api/dist/application.js';
import registration from '../../apps/api/dist/modules/auth/registration.service.js';
import passwordTools from '../../apps/api/dist/modules/auth/password.js';
import delivery from '../../packages/verification-email/dist/index.js';

const owner = 'SPORTIFY_STEP11_TEST_OWNER';
const target = 'fce953xa';
const suffix = '@step11.example.test';
const prefix = 'Step11 synthetic ';
const compromised = 'listed synthetic password';
const passphrase = '  New owner synthetic passphrase  ';
const { verify: verifyPassword } = createRequire(
  new URL('../../apps/api/package.json', import.meta.url),
)('argon2');
const ownerPermissions = [
  'booking.cancel',
  'booking.create',
  'booking.manage',
  'booking.read',
  'business.manage',
  'business.read',
  'customer.manage',
  'customer.read',
  'location.manage',
  'location.read',
  'payment.read',
  'payment.record',
  'payment.refund',
  'report.read',
  'resource.manage',
  'resource.read',
  'staff.manage',
  'subscription.read',
  'website.manage',
];
let phase = 'prerequisites';
let cause;
const fixtureTables = [
  'AUDIT_LOGS',
  'OUTBOX_EVENTS',
  'USER_ROLES',
  'ROLE_PERMISSIONS',
  'ROLES',
  'TENANT_USERS',
  'EMAIL_VERIFICATION_TOKENS',
  'AUTH_SOURCE_WINDOWS',
  'TENANTS',
  'USERS',
];
const requiredSecrets = [
  'ORACLE_MIGRATION_PASSWORD',
  'ORACLE_WALLET_PASSWORD',
  'ORACLE_API_PASSWORD',
  'ORACLE_WORKER_PASSWORD',
];
const missingSecrets = requiredSecrets.filter((name) => !process.env[name]?.length);

function report(check, evidence = {}) {
  console.log(JSON.stringify({ event: 'step11.oracle', result: 'PASS', check, ...evidence }));
}

function diagnostic(error) {
  return {
    code: /^[A-Z][A-Z_]+$/.test(error?.code ?? '') ? error.code : null,
    oracle: Number.isInteger(error?.errorNum) ? error.errorNum : null,
    driver: /^(?:NJS|DPI)-\d+$/.test(error?.code ?? '') ? error.code : null,
    testLine: Number(error?.stack?.match(/oracle-step11\.mjs:(\d+):\d+/)?.[1]) || null,
  };
}

function privilegeDenied(error) {
  // With INSERT access to AUDIT_LOGS, this ATP release reports a missing UPDATE grant as ORA-41900.
  return [942, 1031, 41900].includes(error.errorNum);
}

async function assertCleanFixtureState(session) {
  const counts = fixtureTables.map((table) => `(SELECT COUNT(*) FROM ${table})`).join(', ');
  assert.deepEqual((await session.execute(`SELECT ${counts} FROM DUAL`)).rows, [
    fixtureTables.map(() => 0),
  ]);
  const { rows } = await session.execute(
    `SELECT (SELECT COUNT(*) FROM USER_TAB_PRIVS_MADE WHERE GRANTEE IN ('SPORTIFY_API','SPORTIFY_WORKER'))
     + (SELECT COUNT(*) FROM USER_COL_PRIVS_MADE WHERE GRANTEE IN ('SPORTIFY_API','SPORTIFY_WORKER')) FROM DUAL`,
  );
  assert.deepEqual(rows, [[0]]);
}
function connectionIdentity(database) {
  return database.query(
    "SELECT SYS_CONTEXT('USERENV','SESSION_USER') AS IDENTITY,SYS_CONTEXT('USERENV','DB_UNIQUE_NAME') AS TARGET FROM DUAL",
  );
}

function pairBarrier() {
  const sessions = new Set();
  let release;
  const both = new Promise((resolve) => {
    release = resolve;
  });
  return async (sessionId) => {
    assert.ok(sessionId && !sessions.has(sessionId));
    sessions.add(sessionId);
    if (sessions.size === 2) release();
    let timer;
    try {
      await Promise.race([
        both,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Concurrent test barrier timed out.')), 10_000);
          timer.unref();
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
}

async function localSink() {
  const inbox = [];
  const server = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      inbox.push(JSON.parse(Buffer.concat(chunks).toString()));
      res.writeHead(204).end();
    } catch {
      res.writeHead(400).end();
    }
  });
  await new Promise((resolve, reject) =>
    server.once('error', reject).listen(0, '127.0.0.1', resolve),
  );
  return {
    inbox,
    async send(mail, signal) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}`, {
        method: 'POST',
        body: JSON.stringify(mail),
        signal,
      });
      if (response.status !== 204) throw new Error('Local transport rejected mail.');
    },
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function suite(session, config, runtimes, corpus) {
  const query = async (sql, binds = {}) =>
    (await session.execute(sql, binds, { outFormat: 4002 })).rows;
  const pools = {};
  const poolWarnings = [];
  const openDatabase = (settings, role) =>
    createDatabase(
      settings,
      role,
      async (attributes) => {
        const pool = await oracledb.createPool(attributes);
        pools[role] = pool;
        return pool;
      },
      ({ event }) => poolWarnings.push({ role, event }),
    );
  const api = await openDatabase({ ...runtimes[0].config, ORACLE_POOL_MAX: 4 }, 'api');
  function assertPoolsIdle() {
    assert.deepEqual([pools.api.connectionsInUse, pools.worker.connectionsInUse], [0, 0]);
    assert.deepEqual(poolWarnings, []);
  }
  let worker;
  let app;
  let sink;
  let resourcesClosed = false;
  const events = [];
  const logs = [];
  const databaseErrors = [];
  const httpErrors = [];
  const scopeErrors = [];
  let signupBarrier;
  let verificationBarrier;
  async function observedQuery(execute, sql, binds) {
    try {
      return await execute(sql, binds);
    } catch (error) {
      const { oracle, driver } = diagnostic(error);
      if ((oracle !== null || driver !== null) && databaseErrors.length < 20) {
        const table = sql.match(/SPORTIFY_STEP11_TEST_OWNER\.([A-Z_]+)/)?.[1] ?? null;
        const constraint =
          oracle === 1
            ? (['PK_AUTH_SOURCE_WINDOWS', 'UQ_USERS_EMAIL_NORMALIZED'].find(
                (name) =>
                  error.message.includes(`(${owner}.${name})`) ||
                  error.message.includes(`("${owner}"."${name}")`),
              ) ?? null)
            : null;
        databaseErrors.push({ table, oracle, driver, constraint });
      }
      throw error;
    }
  }
  try {
    worker = await openDatabase(runtimes[1].config, 'worker');
    assert.deepEqual((await connectionIdentity(api)).rows, [
      { IDENTITY: 'SPORTIFY_API', TARGET: target },
    ]);
    assert.deepEqual((await connectionIdentity(worker)).rows, [
      { IDENTITY: 'SPORTIFY_WORKER', TARGET: target },
    ]);
    for (const pool of [api, worker]) {
      assert.deepEqual((await pool.query('SELECT PRIVILEGE FROM SESSION_PRIVS')).rows, [
        { PRIVILEGE: 'CREATE SESSION' },
      ]);
      await assert.rejects(
        pool.query(`SELECT VERSION FROM ${owner}.SCHEMA_MIGRATIONS`),
        privilegeDenied,
      );
      await assert.rejects(
        pool.query(`UPDATE ${owner}.AUDIT_LOGS SET ACTION_CODE=ACTION_CODE WHERE 1=0`),
        privilegeDenied,
      );
    }
    await assert.rejects(
      worker.query(`SELECT PASSWORD_HASH FROM ${owner}.USERS WHERE 1=0`),
      privilegeDenied,
    );
    await assert.rejects(
      api.query(`SELECT * FROM ${owner}.PLATFORM_ADMINS WHERE 1=0`),
      privilegeDenied,
    );
    report('runtime-identity-and-restricted-grants');

    sink = await localSink();
    const deliver = delivery.createVerificationDelivery({
      database: worker,
      owner,
      origin: 'https://sportify.example.test',
      keys: config.keys,
      send: sink.send,
      report: (result) => events.push(result),
    });
    const httpDatabase = {
      ...api,
      async transaction(work) {
        try {
          return await api.transaction((connection) =>
            work({
              async execute(sql, binds) {
                const gate = sql.startsWith(`INSERT INTO ${owner}.USERS (`)
                  ? signupBarrier
                  : sql.startsWith(
                        `SELECT USER_ID FROM ${owner}.USERS WHERE USER_ID=:p_user_id FOR UPDATE`,
                      )
                    ? verificationBarrier
                    : undefined;
                if (gate) {
                  const { rows } = await connection.execute(
                    "SELECT SYS_CONTEXT('USERENV','SID') AS SID FROM DUAL",
                  );
                  await gate(rows?.[0]?.SID);
                }
                return observedQuery(connection.execute, sql, binds);
              },
            }),
          );
        } catch (error) {
          if (scopeErrors.length < 20) scopeErrors.push(diagnostic(error));
          throw error;
        }
      },
      query: (sql, binds) => observedQuery(api.query, sql, binds),
    };
    app = await application.createApiApplication(
      { NODE_ENV: 'test', PORT: 4000, database: runtimes[0].config, registration: config },
      (entry) => logs.push(entry),
      () => Promise.resolve(httpDatabase),
      owner,
    );
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    async function post(path, body) {
      const response = await fetch(`${url}/api/v1/auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
      const payload = await response.json();
      if (!response.ok && httpErrors.length < 20) {
        const code = /^[A-Z][A-Z_]+$/.test(payload.error?.code ?? '') ? payload.error.code : null;
        httpErrors.push({ path, status: response.status, code });
      }
      assert.equal(payload.requestId, response.headers.get('x-request-id'));
      assert.equal(response.headers.get('set-cookie'), null);
      return { status: response.status, payload };
    }
    const register = (email, fullName = 'unverified profile') =>
      post('register', { email, fullName, mobile: '+94770000000' });
    const confirm = (token, label, password = passphrase) => ({
      token,
      password,
      fullName: 'Mailbox holder',
      mobile: '+94770000001',
      tenantName: prefix + label,
    });
    async function reference(email) {
      const rows = await query(
        `SELECT t.PUBLIC_ID AS "tokenId", t.TOKEN_KEY_VERSION AS "keyVersion" FROM EMAIL_VERIFICATION_TOKENS t
         JOIN USERS u ON u.USER_ID=t.USER_ID WHERE u.EMAIL_NORMALIZED=:email ORDER BY t.VERIFICATION_ID DESC`,
        { email },
      );
      const first = rows[0];
      const outbox = await query(
        `SELECT DBMS_LOB.SUBSTR(PAYLOAD, 1000, 1) AS PAYLOAD
         FROM OUTBOX_EVENTS WHERE EVENT_TYPE='auth.email-verification.requested' AND AGGREGATE_ID=:id`,
        { id: first.tokenId },
      );
      assert.equal(outbox.length, 1);
      assert.deepEqual(JSON.parse(outbox[0].PAYLOAD), first);
      return first;
    }
    async function receive(email) {
      const record = await reference(email);
      assert.equal(await deliver(record), 'sent');
      const mail = sink.inbox.at(-1);
      assert.equal(mail.to.toLowerCase(), email);
      const link = mail.text.match(/https:\/\/[^\s]+/)[0];
      assert.equal(new URL(link).search, '');
      return { token: new URLSearchParams(new URL(link).hash.slice(1)).get('token'), record };
    }

    phase = 'duplicate-and-two-confirms';
    const first = 'first' + suffix;
    signupBarrier = pairBarrier();
    const duplicates = await Promise.all([
      register(first),
      register(first.toUpperCase(), 'duplicate profile'),
    ]);
    signupBarrier = undefined;
    for (const item of duplicates) {
      assert.equal(item.status, 202);
      assert.deepEqual(item.payload.data, { status: 'accepted' });
    }
    assert.equal(
      databaseErrors.filter(
        ({ table, constraint }) => table === 'USERS' && constraint === 'UQ_USERS_EMAIL_NORMALIZED',
      ).length,
      1,
    );
    assert.equal(
      databaseErrors.every(({ constraint }) => constraint !== null),
      true,
    );
    assert.deepEqual(scopeErrors, []);
    assertPoolsIdle();
    assert.deepEqual(
      await query(
        `SELECT COUNT(*) AS N FROM USERS WHERE EMAIL_NORMALIZED=:email AND ACCOUNT_STATUS='PENDING' AND PASSWORD_HASH IS NULL`,
        { email: first },
      ),
      [{ N: 1 }],
    );
    assert.deepEqual(await query('SELECT COUNT(*) AS N FROM TENANTS'), [{ N: 0 }]);
    assert.deepEqual(await query('SELECT COUNT(*) AS N FROM EMAIL_VERIFICATION_TOKENS'), [
      { N: 1 },
    ]);
    assert.deepEqual(await query('SELECT COUNT(*) AS N FROM OUTBOX_EVENTS'), [{ N: 1 }]);
    assert.deepEqual(
      await query(`SELECT COUNT(*) AS N FROM EMAIL_VERIFICATION_TOKENS
      WHERE EXPIRES_AT_UTC-CREATED_AT_UTC BETWEEN INTERVAL '59:55' MINUTE TO SECOND AND INTERVAL '60' MINUTE`),
      [{ N: 1 }],
    );
    report('parallel-signup-evidence', {
      attempts: 2,
      statuses: duplicates.map(({ status }) => status),
      canonicalConflicts: 1,
      accounts: 1,
      issued: 1,
      outbox: 1,
      borrowedConnections: 0,
    });
    assert.equal((await post('verification/resend', { email: first })).status, 202);
    assert.deepEqual(await query('SELECT COUNT(*) AS N FROM EMAIL_VERIFICATION_TOKENS'), [
      { N: 1 },
    ]);
    const { token, record } = await receive(first);
    assert.equal((await post('verify-email', confirm(token, 'first', compromised))).status, 422);
    verificationBarrier = pairBarrier();
    const results = await Promise.all([
      post('verify-email', confirm(token, 'first')),
      post('verify-email', confirm(token, 'first')),
    ]);
    verificationBarrier = undefined;
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 400]);
    assertPoolsIdle();
    assert.equal((await register(first, 'post-verification overwrite')).status, 202);
    assert.deepEqual(
      await query(
        `SELECT FULL_NAME,ACCOUNT_STATUS,MOBILE_E164 FROM USERS WHERE EMAIL_NORMALIZED=:email`,
        { email: first },
      ),
      [{ FULL_NAME: 'Mailbox holder', ACCOUNT_STATUS: 'ACTIVE', MOBILE_E164: '+94770000001' }],
    );
    assert.equal(await deliver(record), 'ineligible');
    assert.deepEqual(
      await query(
        "SELECT COUNT(*) AS N FROM USERS WHERE PASSWORD_HASH LIKE '$argon2id$%' AND EMAIL_VERIFIED_AT_UTC IS NOT NULL",
      ),
      [{ N: 1 }],
    );
    const [{ PASSWORD_HASH: storedHash }] = await query(
      'SELECT PASSWORD_HASH FROM USERS WHERE EMAIL_NORMALIZED=:email',
      { email: first },
    );
    assert.equal(await verifyPassword(storedHash, passphrase), true);
    assert.equal(await verifyPassword(storedHash, passphrase.trim()), false);
    report('canonical-duplicate-prehijack-concurrent-confirm-redacted-delivery');

    phase = 'resend-confirm-race-and-rollback';
    const second = 'second' + suffix;
    assert.equal((await register(second)).status, 202);
    const old = await receive(second);
    await session.execute(
      `UPDATE EMAIL_VERIFICATION_TOKENS SET CREATED_AT_UTC=LOCALTIMESTAMP-INTERVAL '61' SECOND WHERE PUBLIC_ID=:id`,
      { id: old.record.tokenId },
    );
    await session.commit();
    let entered;
    let release;
    const hashing = new Promise((resolve) => {
      entered = resolve;
    });
    const proceed = new Promise((resolve) => {
      release = resolve;
    });
    const service = new registration.RegistrationService(api, owner, config, async (password) => {
      entered();
      await proceed;
      return passwordTools.createPasswordEncoder(corpus)(password);
    });
    const confirmation = assert.rejects(
      service.confirm(confirm(old.token, 'second'), randomUUID()),
      { code: 'BAD_REQUEST' },
    );
    try {
      await Promise.race([
        hashing,
        new Promise((_, reject) => {
          const timer = setTimeout(
            () => reject(new Error('Resend race barrier timed out.')),
            10_000,
          );
          timer.unref();
        }),
      ]);
      assert.equal((await post('verification/resend', { email: second })).status, 202);
    } finally {
      release();
    }
    await confirmation;
    assert.equal(await deliver(old.record), 'ineligible');
    assert.deepEqual(
      await query(
        'SELECT COUNT(*) AS N FROM EMAIL_VERIFICATION_TOKENS WHERE PUBLIC_ID=:id AND REVOKED_AT_UTC IS NOT NULL AND CONSUMED_AT_UTC IS NULL',
        { id: old.record.tokenId },
      ),
      [{ N: 1 }],
    );
    const replacement = await receive(second);
    await session.execute(`REVOKE INSERT ON ${owner}.USER_ROLES FROM SPORTIFY_API`);
    try {
      assert.equal((await post('verify-email', confirm(replacement.token, 'second'))).status, 500);
    } finally {
      await session.execute(
        `GRANT INSERT (TENANT_ID,MEMBERSHIP_ID,ROLE_ID) ON ${owner}.USER_ROLES TO SPORTIFY_API`,
      );
    }
    assert.deepEqual(
      await query('SELECT COUNT(*) AS N FROM TENANTS WHERE TENANT_NAME=:name', {
        name: prefix + 'second',
      }),
      [{ N: 0 }],
    );
    assert.deepEqual(
      await query(
        `SELECT COUNT(*) AS N FROM USERS WHERE EMAIL_NORMALIZED=:email AND ACCOUNT_STATUS='PENDING' AND PASSWORD_HASH IS NULL`,
        { email: second },
      ),
      [{ N: 1 }],
    );
    assert.equal((await post('verify-email', confirm(replacement.token, 'second'))).status, 200);
    const roles =
      await query(`SELECT t.TENANT_NAME,r.ROLE_CODE,r.IS_ACTIVE,COUNT(rp.PERMISSION_ID) AS ALLOWED
      FROM TENANTS t JOIN ROLES r ON r.TENANT_ID=t.TENANT_ID LEFT JOIN ROLE_PERMISSIONS rp ON rp.TENANT_ID=r.TENANT_ID AND rp.ROLE_ID=r.ROLE_ID
      WHERE t.STATUS='PENDING_ONBOARDING' GROUP BY t.TENANT_NAME,r.ROLE_CODE,r.IS_ACTIVE ORDER BY t.TENANT_NAME,r.ROLE_CODE`);
    const expectedRoles = ['first', 'second'].flatMap((label) => [
      { TENANT_NAME: prefix + label, ROLE_CODE: 'BUSINESS_MANAGER', IS_ACTIVE: 'N', ALLOWED: 0 },
      { TENANT_NAME: prefix + label, ROLE_CODE: 'BUSINESS_OWNER', IS_ACTIVE: 'Y', ALLOWED: 19 },
      { TENANT_NAME: prefix + label, ROLE_CODE: 'RECEPTIONIST', IS_ACTIVE: 'N', ALLOWED: 0 },
    ]);
    assert.deepEqual(roles, expectedRoles);
    const grantedCodes = await query(`SELECT t.TENANT_NAME, p.PERMISSION_CODE FROM TENANTS t
      JOIN ROLES r ON r.TENANT_ID=t.TENANT_ID AND r.ROLE_CODE='BUSINESS_OWNER'
      JOIN ROLE_PERMISSIONS rp ON rp.TENANT_ID=r.TENANT_ID AND rp.ROLE_ID=r.ROLE_ID
      JOIN PERMISSIONS p ON p.PERMISSION_ID=rp.PERMISSION_ID`);
    for (const name of ['first', 'second']) {
      const codes = grantedCodes
        .filter((row) => row.TENANT_NAME === prefix + name)
        .map((row) => row.PERMISSION_CODE)
        .sort();
      assert.deepEqual(codes, ownerPermissions);
    }
    assert.deepEqual(
      await query(
        `SELECT COUNT(*) AS N FROM USER_ROLES ur JOIN ROLES r ON r.TENANT_ID=ur.TENANT_ID AND r.ROLE_ID=ur.ROLE_ID WHERE r.ROLE_CODE='BUSINESS_OWNER'`,
      ),
      [{ N: 2 }],
    );
    for (const table of ['PLATFORM_ADMINS', 'AUTH_SESSIONS', 'BUSINESSES', 'SUBSCRIPTIONS'])
      assert.deepEqual(await query(`SELECT COUNT(*) AS N FROM ${table}`), [{ N: 0 }]);
    await assert.rejects(
      session.execute(
        `INSERT INTO USER_ROLES (TENANT_ID,MEMBERSHIP_ID,ROLE_ID)
        SELECT m.TENANT_ID,m.MEMBERSHIP_ID,r.ROLE_ID FROM TENANT_USERS m
        JOIN TENANTS first_tenant ON first_tenant.TENANT_ID=m.TENANT_ID
        CROSS JOIN ROLES r JOIN TENANTS second_tenant ON second_tenant.TENANT_ID=r.TENANT_ID
        WHERE first_tenant.TENANT_NAME=:first AND second_tenant.TENANT_NAME=:second AND r.ROLE_CODE='BUSINESS_OWNER'`,
        { first: prefix + 'first', second: prefix + 'second' },
      ),
      (error) => error.errorNum === 2291 && error.message.includes('FK_USER_ROLES_ROLE'),
    );
    const reserved = await query(
      `SELECT COUNT(*) AS N FROM ROLE_PERMISSIONS rp JOIN PERMISSIONS p ON p.PERMISSION_ID=rp.PERMISSION_ID WHERE p.PERMISSION_CODE='subscription.manage'`,
    );
    assert.deepEqual(reserved, [{ N: 0 }]);
    report('resend-wins-invalidates-old-token-rollback-retry-two-scoped-owners');

    phase = 'expiry-account-cap-and-source-cap';
    const third = 'third' + suffix;
    assert.equal((await register(third)).status, 202);
    const expired = await receive(third);
    await session.execute(
      `UPDATE EMAIL_VERIFICATION_TOKENS SET CREATED_AT_UTC=LOCALTIMESTAMP-INTERVAL '2' MINUTE,
      EXPIRES_AT_UTC=LOCALTIMESTAMP-INTERVAL '1' SECOND WHERE PUBLIC_ID=:id`,
      { id: expired.record.tokenId },
    );
    await session.commit();
    assert.equal(await deliver(expired.record), 'ineligible');
    assert.equal((await post('verify-email', confirm(expired.token, 'third'))).status, 400);
    for (let i = 0; i < 2; i++) {
      assert.equal((await post('verification/resend', { email: third })).status, 202);
      const issued = await reference(third);
      await session.execute(
        `UPDATE EMAIL_VERIFICATION_TOKENS SET CREATED_AT_UTC=LOCALTIMESTAMP-INTERVAL '61' SECOND WHERE PUBLIC_ID=:id`,
        { id: issued.tokenId },
      );
      await session.commit();
    }
    assert.equal((await post('verification/resend', { email: third })).status, 202);
    assert.equal((await post('verification/resend', { email: 'source-cap' + suffix })).status, 429);
    assert.deepEqual(
      await query(
        `SELECT COUNT(*) AS N FROM EMAIL_VERIFICATION_TOKENS t JOIN USERS u ON u.USER_ID=t.USER_ID WHERE u.EMAIL_NORMALIZED=:email`,
        { email: third },
      ),
      [{ N: 3 }],
    );
    const evidence = JSON.stringify({ logs, events });
    assert.deepEqual(
      await query(
        'SELECT COUNT(*) AS N FROM AUDIT_LOGS WHERE BEFORE_DATA IS NOT NULL OR AFTER_DATA IS NOT NULL',
      ),
      [{ N: 0 }],
    );
    assert.ok(
      [
        token,
        old.token,
        replacement.token,
        expired.token,
        passphrase,
        first,
        second,
        third,
        config.sourceKey.toString('base64url'),
        config.keys.get(config.activeVersion).toString('base64url'),
      ].every((value) => !evidence.includes(value)),
    );
    assertPoolsIdle();
    const nonUniqueErrors = databaseErrors.filter(({ constraint }) => constraint === null);
    assert.equal(nonUniqueErrors.length, 1);
    const [injectedDenial] = nonUniqueErrors;
    assert.equal(injectedDenial.table, 'USER_ROLES');
    assert.equal(injectedDenial.driver, null);
    assert.ok([942, 1031, 41900].includes(injectedDenial.oracle));
    assert.deepEqual(
      scopeErrors.map(({ code, oracle, driver }) => [code, oracle, driver]),
      [
        ['BAD_REQUEST', null, null],
        [null, injectedDenial.oracle, null],
      ],
    );
    report('oracle-clock-account-source-limits-and-log-redaction', {
      borrowedConnections: 0,
      unexpectedDatabaseErrors: 0,
    });
  } catch (error) {
    if (databaseErrors.length || httpErrors.length || scopeErrors.length || poolWarnings.length) {
      console.info(
        JSON.stringify({
          event: 'step11.oracle',
          phase,
          databaseErrors,
          httpErrors,
          scopeErrors,
          poolWarnings,
        }),
      );
    }
    throw error;
  } finally {
    const results = await Promise.allSettled([
      app ? app.close() : api.close(),
      worker?.close(),
      sink?.close(),
    ]);
    resourcesClosed = results.every((result) => result.status === 'fulfilled');
    if (!resourcesClosed) console.error('Step 11 runtime cleanup failed.');
  }
  assert.ok(resourcesClosed, 'Runtime cleanup failed.');
}

try {
  const args = process.argv.slice(2);
  const resume = args.length === 1 && args[0] === '--resume-after-install';
  assert.ok(args.length === 0 || resume, 'Expected only --resume-after-install.');
  if (missingSecrets.length) throw new Error('Required protected Oracle settings are missing.');
  const config = parseMigrationConfig(process.env);
  assert.equal(config.ORACLE_MIGRATION_DB_UNIQUE_NAME, target);
  assert.equal(config.ORACLE_MIGRATION_SCHEMA, owner);
  assert.equal(process.env.ORACLE_MIGRATION_TEST_CONFIRM, 'isolated-disposable-empty');
  const runtimes = runtimeVerificationConfigs(process.env);
  const release = await loadManifest(fileURLToPath(new URL('../', import.meta.url)));
  const manifest = { ...release, migrations: release.migrations.slice(0, 27) };
  assert.equal(manifest.migrations.at(-1).version, '000027');
  const folder = await mkdtemp(join(tmpdir(), 'sportify-step11-oracle-'));
  const corpus = join(folder, 'synthetic-hashes.txt');
  try {
    await writeFile(
      corpus,
      createHash('sha1').update(compromised).digest('hex').toUpperCase() + '\n',
    );
    await withOwnerSession(config, async (session) => {
      phase = 'disposable-owner';
      assert.deepEqual(
        (await session.execute('SELECT PRIVILEGE FROM USER_SYS_PRIVS ORDER BY PRIVILEGE')).rows,
        [['CREATE SEQUENCE'], ['CREATE SESSION'], ['CREATE TABLE'], ['CREATE VIEW']],
      );
      phase = 'migration-and-exact-catalog';
      if (resume) await verifySession(session, owner, manifest);
      else {
        assert.deepEqual((await session.execute('SELECT COUNT(*) FROM USER_OBJECTS')).rows, [[0]]);
        assert.equal((await migrateSession(session, owner, manifest, () => {})).length, 27);
      }
      assert.deepEqual(await migrateSession(session, owner, manifest, () => {}), []);
      if (!resume) await verifySession(session, owner, manifest);
      report(resume ? 'installed-schema-repeat-catalog' : 'new-install-repeat-catalog');
      phase = 'clean-fixture-baseline';
      await assertCleanFixtureState(session);
      const auth = {
        keys: new Map([['v1', randomBytes(32)]]),
        activeVersion: 'v1',
        sourceKey: randomBytes(32),
        issueLimit: 10,
        confirmLimit: 30,
        maxAttempts: 2,
        passwordBlocklist: corpus,
      };
      try {
        phase = 'restricted-grants';
        await grantRegistration(session, owner, (operation) => {
          phase = operation;
        });
        phase = 'runtime-restricted-privileges';
        await suite(session, auth, runtimes, corpus);
        phase = 'fixture-cleanup';
        assert.deepEqual(
          (
            await session.execute(
              'SELECT COUNT(*) FROM USERS WHERE EMAIL_NORMALIZED NOT LIKE :suffix OR EMAIL_NORMALIZED IS NULL',
              { suffix: '%' + suffix },
            )
          ).rows,
          [[0]],
        );
        assert.deepEqual(
          (
            await session.execute(
              'SELECT COUNT(*) FROM TENANTS WHERE TENANT_NAME NOT LIKE :prefix',
              { prefix: prefix + '%' },
            )
          ).rows,
          [[0]],
        );
        for (const table of fixtureTables) await session.execute(`DELETE FROM ${table}`);
        await session.commit();
      } catch (error) {
        cause = diagnostic(error);
        throw error;
      } finally {
        await revokeDisposableRegistration(session, owner);
      }
      phase = 'post-run-cleanup-check';
      await assertCleanFixtureState(session);
    });
  } finally {
    await rm(corpus, { force: true });
    await rmdir(folder);
  }
  report('complete');
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'step11.oracle',
      result: phase === 'prerequisites' ? 'BLOCKED' : 'FAIL',
      phase,
      ...(missingSecrets.length ? { missing: missingSecrets } : {}),
      ...(cause ?? diagnostic(error)),
    }),
  );
  process.exitCode = 1;
}
