import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import oracledb from 'oracledb';
import { createDatabase, parseDatabaseConfig } from '@sportify/database';
import {
  loadManifest,
  migrateSession,
  parseMigrationConfig,
  verifySession,
  withOwnerSession,
} from '@sportify/migrations';
import { observedPoolFactory } from './step10/pool-observer.mjs';

const owner = 'SPORTIFY_STEP13_TEST_OWNER';
const target = 'fce953xa';
const fixtureTables = [
  'WEBSITE_SETTINGS',
  'WEBSITE_THEMES',
  'RESOURCES',
  'BUSINESS_SPORTS',
  'LOCATIONS',
  'BUSINESSES',
  'AUTH_SESSIONS',
  'AUTH_SOURCE_WINDOWS',
  'TENANT_USERS',
  'USERS',
  'TENANTS',
];
const keep = ['SCHEMA_MIGRATIONS', 'SPORTS', 'PERMISSIONS'];
// Oracle records this default grant on the user account in the same view as
// schema object grants. Keep every other grant in the exact comparison.
const outgoingObjectGrants = `USER_TAB_PRIVS_MADE
  WHERE NOT (
    GRANTEE = 'PUBLIC' AND GRANTOR = USER AND TABLE_NAME = USER
    AND PRIVILEGE = 'INHERIT PRIVILEGES' AND TYPE = 'USER'
    AND GRANTABLE = 'NO' AND HIERARCHY = 'NO' AND COMMON = 'NO' AND INHERITED = 'NO'
  )`;
const apiGrants = [
  ...[
    'TENANTS',
    'TENANT_USERS',
    'BUSINESSES',
    'BUSINESS_SPORTS',
    'LOCATIONS',
    'SPORTS',
    'WEBSITE_SETTINGS',
  ].map((table) => ['READ', table]),
  ['READ', 'USERS'],
  ['SELECT', 'RESOURCES'],
  [
    'INSERT',
    'RESOURCES',
    'TENANT_ID,BUSINESS_ID,LOCATION_ID,SPORT_ID,RESOURCE_CODE,RESOURCE_NAME,RESOURCE_TYPE,PUBLIC_ID',
  ],
  ['UPDATE', 'RESOURCES', 'RESOURCE_NAME,RESOURCE_STATUS,UPDATED_AT_UTC'],
  ['DELETE', 'RESOURCES'],
  ['SELECT', 'AUTH_SOURCE_WINDOWS'],
  ['INSERT', 'AUTH_SOURCE_WINDOWS', 'SOURCE_HASH,ACTION_SCOPE,WINDOW_END_UTC,REQUEST_COUNT'],
  ['UPDATE', 'AUTH_SOURCE_WINDOWS', 'REQUEST_COUNT,WINDOW_END_UTC'],
  ['SELECT', 'VW_AUTH_DASHBOARD_SESSIONS'],
  ['UPDATE', 'VW_AUTH_DASHBOARD_SESSIONS', 'IDLE_EXPIRES_AT_UTC,LAST_SEEN_AT_UTC'],
];
let phase = 'protected-prerequisites';

function prove(check) {
  console.log(JSON.stringify({ event: 'step13.oracle', result: 'PASS', check }));
}

function reportFailure(error, failedPhase = phase) {
  console.error(
    JSON.stringify({
      event: 'step13.oracle',
      result: 'FAIL',
      phase: failedPhase,
      code: /^[A-Z][A-Z_]+$/.test(error?.code ?? '') ? error.code : null,
      oracle: Number.isInteger(error?.errorNum) ? error.errorNum : null,
      driver: /^(?:NJS|DPI)-\d+$/.test(error?.code ?? '') ? error.code : null,
      line: Number(error?.stack?.match(/oracle-step13\.mjs:(\d+):\d+/)?.[1]) || null,
    }),
  );
}

function bindQueries(session) {
  const execute = (sql, binds = {}) =>
    session.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const rows = async (sql, binds) => (await execute(sql, binds)).rows;
  const count = async (table) => (await rows('SELECT COUNT(*) AS TOTAL FROM ' + table))[0].TOTAL;
  return { execute, rows, count };
}

async function assertEmpty(db) {
  for (const { TABLE_NAME: table } of await db.rows('SELECT TABLE_NAME FROM USER_TABLES')) {
    assert.match(table, /^[A-Z][A-Z0-9_]*$/);
    if (!keep.includes(table)) assert.equal(await db.count(table), 0);
  }
  assert.equal(await db.count(outgoingObjectGrants), 0);
  assert.equal(await db.count('USER_COL_PRIVS_MADE'), 0);
}

async function applyGrants(db) {
  for (const [action, table, columns] of apiGrants)
    await db.execute(
      `GRANT ${action}${columns ? ' (' + columns + ')' : ''} ON ${owner}.${table} TO SPORTIFY_API`,
    );
  const compare = (items) => items.map((item) => JSON.stringify(item)).sort();
  for (const [view, fields, expected] of [
    [
      outgoingObjectGrants,
      'PRIVILEGE,TABLE_NAME,GRANTEE,GRANTABLE',
      apiGrants
        .filter(([, , columns]) => !columns)
        .map(([action, table]) => [action, table, 'SPORTIFY_API', 'NO']),
    ],
    [
      'USER_COL_PRIVS_MADE',
      'PRIVILEGE,TABLE_NAME,COLUMN_NAME,GRANTEE,GRANTABLE',
      apiGrants.flatMap(
        ([action, table, columns]) =>
          columns?.split(',').map((column) => [action, table, column, 'SPORTIFY_API', 'NO']) ?? [],
      ),
    ],
  ]) {
    assert.deepEqual(
      compare((await db.rows('SELECT ' + fields + ' FROM ' + view)).map(Object.values)),
      compare(expected),
    );
  }
}

async function cleanup(session, db) {
  const failures = [];
  try {
    assert.equal(
      (
        await db.rows(
          "SELECT COUNT(*) AS N FROM USERS WHERE EMAIL_NORMALIZED NOT LIKE '%@step13.example.test'",
        )
      )[0].N,
      0,
    );
    assert.equal(
      (await db.rows("SELECT COUNT(*) AS N FROM TENANTS WHERE TENANT_CODE NOT LIKE 'S13-%'"))[0].N,
      0,
    );
    for (const table of fixtureTables) await db.execute('DELETE FROM ' + table);
    await session.commit();
  } catch (error) {
    await session.rollback().catch(() => {});
    failures.push(error);
  }
  for (const [action, table] of [...apiGrants].reverse()) {
    try {
      await db.execute(`REVOKE ${action} ON ${owner}.${table} FROM SPORTIFY_API`);
    } catch (error) {
      if (error?.errorNum !== 1927) failures.push(error);
    }
  }
  if (failures.length) throw failures[0];
  await assertEmpty(db);
}

async function seed(db) {
  const [alphaSport, betaSport] = await db.rows(
    'SELECT SPORT_ID,SPORT_CODE FROM SPORTS ORDER BY SPORT_ID FETCH FIRST 2 ROWS ONLY',
  );
  await db.execute(
    "INSERT INTO WEBSITE_THEMES (THEME_CODE,THEME_NAME) VALUES ('S13','Synthetic theme')",
  );
  const theme = (await db.rows("SELECT THEME_ID FROM WEBSITE_THEMES WHERE THEME_CODE='S13'"))[0]
    .THEME_ID;
  const tenants = [];
  for (const [name, capacity, sport] of [
    ['alpha', 4, alphaSport],
    ['beta', 17, betaSport],
  ]) {
    const tenant = {
      name,
      id: randomUUID(),
      business: randomUUID(),
      location: randomUUID(),
      resource: randomUUID(),
    };
    await db.execute(
      `INSERT INTO TENANTS (PUBLIC_ID,TENANT_CODE,TENANT_NAME,STATUS)
      VALUES (:publicId,:code,:code,'ACTIVE')`,
      { publicId: tenant.id, code: 'S13-' + name },
    );
    const tenantId = (
      await db.rows('SELECT TENANT_ID FROM TENANTS WHERE PUBLIC_ID=:id', { id: tenant.id })
    )[0].TENANT_ID;
    await db.execute(
      `INSERT INTO BUSINESSES (TENANT_ID,BUSINESS_NAME,BUSINESS_SLUG,BUSINESS_STATUS,PUBLIC_ID,LEGAL_NAME)
      VALUES (:tenantId,:displayName,:slug,'ACTIVE',:id,'private-business-sentinel')`,
      { tenantId, displayName: name + ' venue', slug: 's13-' + name, id: tenant.business },
    );
    const businessId = (
      await db.rows('SELECT BUSINESS_ID FROM BUSINESSES WHERE TENANT_ID=:tenantId', { tenantId })
    )[0].BUSINESS_ID;
    await db.execute(
      'INSERT INTO BUSINESS_SPORTS (TENANT_ID,BUSINESS_ID,SPORT_ID) VALUES (:tenantId,:businessId,:sportId)',
      { tenantId, businessId, sportId: sport.SPORT_ID },
    );
    await db.execute(
      `INSERT INTO WEBSITE_SETTINGS (TENANT_ID,BUSINESS_ID,THEME_ID,SUBDOMAIN_SLUG,WEBSITE_STATUS,PUBLISHED_AT_UTC,PUBLIC_ID,PAGE_TITLE)
        VALUES (:tenantId,:businessId,:theme,:slug,'PUBLISHED',LOCALTIMESTAMP,:id,:title)`,
      {
        tenantId,
        businessId,
        theme,
        slug: 's13-' + name,
        id: randomUUID(),
        title: name + ' homepage',
      },
    );
    await db.execute(
      `INSERT INTO LOCATIONS (TENANT_ID,BUSINESS_ID,LOCATION_CODE,LOCATION_NAME,ADDRESS_LINE_1,CITY,PUBLIC_ID)
        VALUES (:tenantId,:businessId,'S13',:locationName,'Private test address','Fixture city',:id)`,
      { tenantId, businessId, locationName: name + ' location', id: tenant.location },
    );
    const locationId = (
      await db.rows('SELECT LOCATION_ID FROM LOCATIONS WHERE PUBLIC_ID=:id', {
        id: tenant.location,
      })
    )[0].LOCATION_ID;
    await db.execute(
      `INSERT INTO RESOURCES (TENANT_ID,BUSINESS_ID,LOCATION_ID,SPORT_ID,RESOURCE_CODE,RESOURCE_NAME,RESOURCE_TYPE,CAPACITY,PUBLIC_ID)
        VALUES (:tenantId,:businessId,:locationId,:sportId,'S13-1',:resourceName,'COURT',:capacity,:id)`,
      {
        tenantId,
        businessId,
        locationId,
        sportId: sport.SPORT_ID,
        resourceName: name + ' court',
        capacity,
        id: tenant.resource,
      },
    );
    tenants.push({ ...tenant, tenantId, capacity });
  }
  const digest = (await import('../../packages/verification-email/dist/index.js')).default
    .tokenDigest;
  const tokens = {
    dashboard: randomBytes(32).toString('base64url'),
    admin: randomBytes(32).toString('base64url'),
  };
  const user = randomUUID();
  await db.execute(
    `INSERT INTO USERS (PUBLIC_ID,FULL_NAME,EMAIL,EMAIL_NORMALIZED,PASSWORD_HASH,ACCOUNT_STATUS,EMAIL_VERIFIED_AT_UTC)
      VALUES (:id,'Synthetic Step 13 member',:email,:email,'synthetic-no-login-hash','ACTIVE',LOCALTIMESTAMP)`,
    { id: user, email: 'member@step13.example.test' },
  );
  const userId = (await db.rows('SELECT USER_ID FROM USERS WHERE PUBLIC_ID=:id', { id: user }))[0]
    .USER_ID;
  for (const { tenantId } of tenants)
    await db.execute(
      `INSERT INTO TENANT_USERS (TENANT_ID,USER_ID,MEMBERSHIP_STATUS,PUBLIC_ID)
      VALUES (:tenantId,:userId,'ACTIVE',:id)`,
      { tenantId, userId, id: randomUUID() },
    );
  for (const [audience, token] of Object.entries(tokens))
    await db.execute(
      `INSERT INTO AUTH_SESSIONS
      (USER_ID,AUDIENCE,TOKEN_HASH,EXPIRES_AT_UTC,IDLE_EXPIRES_AT_UTC,LAST_SEEN_AT_UTC)
      VALUES (:userId,:audience,:digest,LOCALTIMESTAMP+INTERVAL '2' HOUR,
        LOCALTIMESTAMP+INTERVAL '1' HOUR,LOCALTIMESTAMP)`,
      { userId, audience: audience.toUpperCase(), digest: digest(token) },
    );
  return {
    tenants,
    tokens,
    sportCode: alphaSport.SPORT_CODE,
    foreignSportCode: betaSport.SPORT_CODE,
  };
}

function buildBarrier() {
  let release;
  const rendezvous = new Promise((resolve) => {
    release = resolve;
  });
  const sessions = new Set();
  return {
    sessions,
    release,
    async arrive(connection) {
      const { rows } = await connection.execute(
        "SELECT SYS_CONTEXT('USERENV','SID') AS SID FROM DUAL",
      );
      assert.ok(rows[0].SID);
      assert.ok(!sessions.has(rows[0].SID));
      sessions.add(rows[0].SID);
      if (sessions.size === 2) release();
      const signal = AbortSignal.timeout(10000);
      let rejectWait;
      const blocked = new Promise((_resolve, reject) => {
        rejectWait = reject;
      });
      const fail = () => rejectWait(new Error('Oracle membership barrier timed out.'));
      signal.addEventListener('abort', fail, { once: true });
      try {
        await Promise.race([rendezvous, blocked]);
      } finally {
        signal.removeEventListener('abort', fail);
      }
    },
  };
}

async function liveWorkflows(session, db, fixtures, runtime, corpus) {
  const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
  require('reflect-metadata');
  const { Controller, Get, Post, Req, UseGuards, Module } = require('@nestjs/common');
  const { NestFactory } = require('@nestjs/core');
  const { configureApp } = require('./dist/bootstrap/configure-app.js');
  const { AccountModule } = require('./dist/modules/auth/account.module.js');
  const { parseSessionConfig } = require('./dist/modules/auth/session-config.js');
  const { TenantRepositories } = require('./dist/modules/tenancy/tenant-repositories.js');
  const {
    TenantModule,
    TenantMemberGuard,
    WebsiteTenantGuard,
    memberScope,
    websiteScope,
  } = require('./dist/modules/tenancy/tenant.module.js');
  const key = () => randomBytes(32).toString('base64url');
  const origin = 'https://app.sportify.lk';
  const browser = parseSessionConfig(
    {
      AUTH_ACCOUNT_ENABLED: 'true',
      AUTH_DASHBOARD_ORIGIN: origin,
      AUTH_CSRF_KEY: key(),
      AUTH_SOURCE_KEY: key(),
      AUTH_RESET_KEYS: JSON.stringify({ r1: key() }),
      AUTH_RESET_KEY_VERSION: 'r1',
      AUTH_RESET_OUTBOX_MAX_ATTEMPTS: '2',
      AUTH_LOGIN_PAIR_LIMIT: '10',
      AUTH_SESSION_SOURCE_LIMIT: '100',
      AUTH_PASSWORD_BLOCKLIST_PATH: corpus,
    },
    'test',
  );
  const observed = observedPoolFactory();
  const singleObserved = observedPoolFactory();
  const api = await createDatabase({ ...runtime, ORACLE_POOL_MAX: 2 }, 'api', observed.factory);
  const [alpha, beta] = fixtures.tenants;
  let app;
  let single;
  let barrier;
  const savedScopes = new Map();
  const logs = [];
  const repos = new TenantRepositories(api, owner);
  const resourceInput = {
    locationPublicId: alpha.location,
    code: 'S13-NEW',
    name: 'Created court',
    type: 'COURT',
    sportCode: fixtures.sportCode,
  };
  // Record actual session identities at the membership query boundary.
  const intercepted = {
    ...api,
    query(sql, binds) {
      if (!barrier || !sql.includes('m.MEMBERSHIP_ID')) return api.query(sql, binds);
      return api.withConnection(async (connection) => {
        await barrier.arrive(connection);
        return connection.execute(sql, binds);
      });
    },
  };
  let changedResource;
  let closedTransaction;
  class PrivateProof {
    async read(request) {
      const context = memberScope(request);
      savedScopes.set(context.tenantPublicId, context);
      const resources = repos.resources(context);
      const other = context.tenantPublicId === alpha.id ? beta : alpha;
      return {
        list: await resources.list(),
        totals: await resources.totals(),
        guessed: await resources.find(other.resource),
      };
    }

    async write(request) {
      const context = memberScope(request);
      if (request.query.probe === 'rollback') {
        return repos.transaction(context, async (resources) => {
          assert.equal(await resources.rename(alpha.resource, 'Rolled back'), true);
          await resources.insert({ ...resourceInput, code: 'S13-ROLLBACK' });
          throw new Error('Intentional isolation rollback.');
        });
      }
      return repos.transaction(context, async (resources) => {
        closedTransaction = resources;
        await assert.rejects(
          () => repos.resources(savedScopes.get(beta.id)).list(),
          (error) => error?.classification === 'nested_scope',
        );
        const denial = {
          rename: await resources.rename(beta.resource, 'Unauthorized'),
          remove: await resources.remove(beta.resource),
          insert: await resources.insert({
            ...resourceInput,
            locationPublicId: beta.location,
            tenantId: beta.tenantId,
          }),
          sport: await resources.insert({ ...resourceInput, sportCode: fixtures.foreignSportCode }),
          mixed: await resources.deactivate([alpha.resource, beta.resource]),
        };
        if (request.query.probe === 'denials') return denial;
        changedResource = await resources.insert({ ...resourceInput, tenantId: beta.tenantId });
        assert.ok(changedResource);
        const ownRead = await resources.find(changedResource);
        assert.equal(await resources.rename(changedResource, 'Renamed court'), true);
        assert.equal(await resources.deactivate([changedResource]), true);
        assert.equal((await resources.find(changedResource)).RESOURCE_STATUS, 'INACTIVE');
        assert.equal(await resources.remove(changedResource), true);
        assert.equal(await resources.find(changedResource), null);
        return { denial, location: ownRead.LOCATION_NAME };
      });
    }
  }
  class PublicProof {
    show(request) {
      const context = websiteScope(request);
      assert.throws(() => repos.resources(context));
      return repos.website(context);
    }
  }
  const decorate = (controller, method, decorator) => {
    Req()(controller.prototype, method, 0);
    decorator(
      controller.prototype,
      method,
      Object.getOwnPropertyDescriptor(controller.prototype, method),
    );
  };
  Controller('tenants/:tenantPublicId')(PrivateProof);
  UseGuards(TenantMemberGuard)(PrivateProof);
  decorate(PrivateProof, 'read', Get('proof'));
  decorate(PrivateProof, 'write', Post('proof'));
  Controller('public/website')(PublicProof);
  UseGuards(WebsiteTenantGuard)(PublicProof);
  decorate(PublicProof, 'show', Get());
  class LiveTestModule {}
  Module({})(LiveTestModule);
  try {
    phase = 'runtime-identity-and-denials';
    const { rows: identities } = await api.query(
      "SELECT SYS_CONTEXT('USERENV','DB_UNIQUE_NAME') AS TARGET,SYS_CONTEXT('USERENV','SESSION_USER') AS ACTOR FROM DUAL",
    );
    assert.deepEqual(identities, [{ TARGET: target, ACTOR: 'SPORTIFY_API' }]);
    assert.deepEqual((await api.query('SELECT PRIVILEGE FROM SESSION_PRIVS')).rows, [
      { PRIVILEGE: 'CREATE SESSION' },
    ]);
    for (const sql of [
      `SELECT * FROM ${owner}.SCHEMA_MIGRATIONS WHERE 1=0`,
      `SELECT * FROM ${owner}.AUDIT_LOGS WHERE 1=0`,
      `SELECT * FROM ${owner}.CUSTOMERS WHERE 1=0`,
      `SELECT * FROM ${owner}.AUTH_SESSIONS WHERE 1=0`,
      `UPDATE ${owner}.RESOURCES SET TENANT_ID=TENANT_ID WHERE 1=0`,
    ])
      await assert.rejects(
        () => api.query(sql),
        (error) => [942, 1031, 41900].includes(error?.errorNum),
      );
    prove('restricted API identity and five exact access denials');

    phase = 'http-session-and-tenant-race';
    app = await NestFactory.create(
      {
        module: LiveTestModule,
        imports: [
          TenantModule.register(intercepted, owner, AccountModule.register(api, owner, browser)),
        ],
        controllers: [PrivateProof, PublicProof],
      },
      { logger: false, abortOnError: false },
    );
    configureApp(app, (entry) => logs.push(entry), { environment: 'production', port: 4000 });
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const cookie = (raw = fixtures.tokens.dashboard) => '__Host-sportify_session=' + raw;
    const request = (
      route,
      { method = 'GET', host = 'app.sportify.lk', headers = {}, timeoutMs = 15000 } = {},
    ) =>
      new Promise((resolve, reject) => {
        const upstream = httpRequest(
          base + '/api/v1/' + route,
          {
            method,
            headers: { Host: host, ...headers },
            signal: AbortSignal.timeout(timeoutMs),
          },
          (response) => {
            response.setEncoding('utf8');
            let payload = '';
            response.on('data', (chunk) => {
              payload += chunk;
            });
            response.on('error', reject);
            response.on('end', () => {
              try {
                resolve({
                  status: response.statusCode,
                  headers: response.headers,
                  payload: JSON.parse(payload),
                });
              } catch (error) {
                reject(error);
              }
            });
          },
        );
        upstream.on('error', reject);
        upstream.end();
      });
    const site = (name) => request('public/website', { host: 's13-' + name + '.sportify.lk' });
    const read = (tenant, raw) =>
      request('tenants/' + tenant.id + '/proof', { headers: { Cookie: cookie(raw) } });
    const bootstrap = await request('auth/csrf', {
      headers: { Cookie: cookie(), 'X-CSRF-Bootstrap': '1' },
    });
    assert.equal(bootstrap.status, 200);
    const csrf = bootstrap.headers['set-cookie'][0].split(';', 1)[0];
    const write = (probe = '') =>
      request('tenants/' + alpha.id + '/proof' + probe, {
        method: 'POST',
        // The write proof runs several bounded Oracle calls in one HTTP request.
        timeoutMs: 45000,
        headers: {
          Cookie: cookie() + '; ' + csrf,
          Origin: origin,
          'X-CSRF-Token': bootstrap.payload.data.csrfToken,
        },
      });
    assert.equal((await read(alpha, fixtures.tokens.admin)).status, 401);
    assert.equal(
      (
        await request('tenants/' + alpha.id + '/proof', {
          host: 's13-alpha.sportify.lk',
          headers: { Cookie: cookie() },
        })
      ).status,
      404,
    );
    barrier = buildBarrier();
    const [first, second] = await Promise.all([read(alpha), read(beta)]);
    assert.equal(barrier.sessions.size, 2);
    barrier = undefined;
    for (const [result, tenant] of [
      [first, alpha],
      [second, beta],
    ]) {
      assert.equal(result.status, 200);
      assert.deepEqual(result.payload.data, {
        guessed: null,
        list: [
          {
            PUBLIC_ID: tenant.resource,
            RESOURCE_NAME: tenant.name + ' court',
            RESOURCE_STATUS: 'ACTIVE',
            LOCATION_NAME: tenant.name + ' location',
          },
        ],
        totals: { RESOURCE_COUNT: '1', TOTAL_CAPACITY: String(tenant.capacity) },
      });
    }
    assert.deepEqual((await site('alpha')).payload.data, {
      BUSINESS_NAME: 'alpha venue',
      PAGE_TITLE: 'alpha homepage',
    });
    assert.equal((await site('unmapped')).status, 404);
    await db.execute(
      "UPDATE WEBSITE_SETTINGS SET WEBSITE_STATUS='UNPUBLISHED' WHERE SUBDOMAIN_SLUG='s13-beta'",
    );
    await session.commit();
    assert.equal((await site('beta')).status, 404);
    prove('actual Oracle dashboard audience distinct-session race and published-only projection');

    phase = 'scoped-writes-and-bulk';
    const changes = await write();
    assert.equal(changes.status, 201);
    await assert.rejects(
      () => closedTransaction.list(),
      (error) => error?.classification === 'scope_closed',
    );
    assert.deepEqual(changes.payload.data, {
      denial: { rename: false, remove: false, insert: null, sport: null, mixed: false },
      location: 'alpha location',
    });
    const original = await db.rows(
      'SELECT RESOURCE_NAME,RESOURCE_STATUS,CAPACITY FROM RESOURCES ORDER BY RESOURCE_ID',
    );
    assert.deepEqual(original.map(Object.values), [
      ['alpha court', 'ACTIVE', 4],
      ['beta court', 'ACTIVE', 17],
    ]);
    phase = 'resource-rollback';
    const rolledBack = await write('?probe=rollback');
    assert.equal(rolledBack.status, 500);
    assert.deepEqual(
      await db.rows(
        'SELECT RESOURCE_NAME,RESOURCE_STATUS,CAPACITY FROM RESOURCES ORDER BY RESOURCE_ID',
      ),
      original,
    );
    assert.ok(observed.state.rollbacks >= 1);
    phase = 'membership-and-tenant-state-recheck';
    await db.execute(
      "UPDATE TENANT_USERS SET MEMBERSHIP_STATUS='REVOKED' WHERE TENANT_ID=:tenantId",
      { tenantId: beta.tenantId },
    );
    await db.execute("UPDATE TENANTS SET STATUS='SUSPENDED' WHERE TENANT_ID=:tenantId", {
      tenantId: alpha.tenantId,
    });
    await session.commit();
    assert.equal((await read(beta)).status, 404);
    assert.equal((await read(alpha)).status, 200);
    assert.deepEqual((await write('?probe=denials')).payload.data, {
      rename: false,
      remove: false,
      insert: null,
      sport: null,
      mixed: false,
    });
    assert.equal((await site('alpha')).status, 200);
    prove(
      'tenant-derived insert own mutation foreign IDs mixed bulk rollback and changed tenant/membership state',
    );

    phase = 'single-session-reuse';
    single = await createDatabase(runtime, 'api', singleObserved.factory);
    const ids = new Set();
    const scoped = new TenantRepositories(
      {
        ...single,
        query: (sql, binds) =>
          single.withConnection(async (connection) => {
            const observation = await connection.execute(
              "SELECT SYS_CONTEXT('USERENV','SID') AS SID FROM DUAL",
            );
            ids.add(observation.rows[0].SID);
            return connection.execute(sql, binds);
          }),
      },
      owner,
    );
    for (const tenant of [alpha, beta, alpha, beta]) {
      const list = await scoped.resources(savedScopes.get(tenant.id)).list();
      assert.deepEqual(
        list.map((item) => item.PUBLIC_ID),
        [tenant.resource],
      );
    }
    assert.equal(ids.size, 1);
    assert.equal(singleObserved.state.pool.connectionsInUse, 0);
    assert.equal(observed.state.pool.connectionsInUse, 0);
    for (const value of [
      ...Object.values(fixtures.tokens),
      browser.csrfKey.toString('base64url'),
      'private-business-sentinel',
    ])
      assert.ok(!JSON.stringify({ logs, first, second, rolledBack }).includes(value));
    prove('shared Oracle session reuse and redacted logs');
  } finally {
    barrier?.release();
    try {
      await app?.close();
    } finally {
      const settled = await Promise.allSettled([api.close(), single?.close()]);
      assert.ok(settled.every((result) => result.status === 'fulfilled'));
    }
  }
  assert.equal(observed.state.closed, 1);
  assert.equal(singleObserved.state.closed, 1);
}

try {
  const missing = [
    'ORACLE_MIGRATION_PASSWORD',
    'ORACLE_WALLET_PASSWORD',
    'ORACLE_API_PASSWORD',
  ].filter((name) => !process.env[name]);
  if (missing.length)
    console.error(JSON.stringify({ event: 'step13.oracle.prerequisites', missing }));
  assert.equal(missing.length, 0);
  const migration = parseMigrationConfig(process.env);
  assert.equal(migration.ORACLE_MIGRATION_SCHEMA, owner);
  assert.equal(migration.ORACLE_MIGRATION_USER, owner);
  assert.equal(migration.ORACLE_MIGRATION_DB_UNIQUE_NAME, target);
  assert.equal(process.env.ORACLE_MIGRATION_TEST_CONFIRM, 'isolated-disposable-empty');
  const [option, ...remaining] = process.argv.slice(2);
  assert.ok(remaining.length === 0 && [undefined, '--resume-after-install'].includes(option));
  const manifest = await loadManifest(fileURLToPath(new URL('../', import.meta.url)));
  assert.deepEqual(
    manifest.migrations.map(({ version }) => version),
    Array.from({ length: 28 }, (_, index) => String(index + 1).padStart(6, '0')),
  );
  const runtime = parseDatabaseConfig(
    {
      ...process.env,
      ORACLE_USER: 'SPORTIFY_API',
      ORACLE_PASSWORD: process.env.ORACLE_API_PASSWORD,
      ORACLE_POOL_MIN: '0',
      ORACLE_POOL_MAX: '1',
      ORACLE_POOL_INCREMENT: '1',
      ORACLE_QUEUE_TIMEOUT_MS: '5000',
      ORACLE_CALL_TIMEOUT_MS: '5000',
    },
    'api',
  );
  const temporary = await mkdtemp(join(tmpdir(), 'sportify-step13-'));
  try {
    const corpus = join(temporary, 'synthetic.txt');
    await writeFile(corpus, 'F'.repeat(40) + '\n');
    await withOwnerSession(migration, async (session) => {
      const db = bindQueries(session);
      phase = 'disposable-owner-preflight';
      assert.deepEqual(
        (await db.rows('SELECT PRIVILEGE,ADMIN_OPTION FROM USER_SYS_PRIVS ORDER BY PRIVILEGE')).map(
          Object.values,
        ),
        [
          ['CREATE SEQUENCE', 'NO'],
          ['CREATE SESSION', 'NO'],
          ['CREATE TABLE', 'NO'],
          ['CREATE VIEW', 'NO'],
        ],
      );
      assert.equal(await db.count('USER_ROLE_PRIVS'), 0);
      assert.deepEqual(
        await db.rows('SELECT TABLESPACE_NAME,MAX_BYTES FROM USER_TS_QUOTAS WHERE MAX_BYTES<>0'),
        [{ TABLESPACE_NAME: 'DATA', MAX_BYTES: 268435456 }],
      );
      if (!option) {
        phase = 'clean-install';
        assert.equal(await db.count('USER_OBJECTS'), 0);
        assert.equal((await migrateSession(session, owner, manifest)).length, 28);
      }
      phase = 'verify-installed-catalog';
      await verifySession(session, owner, manifest);
      phase = 'migration-no-op';
      assert.deepEqual(await migrateSession(session, owner, manifest), []);
      phase = 'empty-fixture-and-grant-baseline';
      await assertEmpty(db);
      prove('disposable 28-migration catalog and exact no-op replay');
      let failedPhase;
      try {
        phase = 'disposable-only-grants-and-data';
        await applyGrants(db);
        const fixtures = await seed(db);
        await session.commit();
        await liveWorkflows(session, db, fixtures, runtime, corpus);
      } catch (error) {
        failedPhase = phase;
        reportFailure(error, failedPhase);
        throw error;
      } finally {
        phase = 'cleanup';
        await cleanup(session, db);
        await verifySession(session, owner, manifest);
        prove('runtime pools closed and no fixtures or grants remain');
        phase = failedPhase ?? 'complete';
      }
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
} catch (error) {
  reportFailure(error);
  process.exitCode = 1;
}
