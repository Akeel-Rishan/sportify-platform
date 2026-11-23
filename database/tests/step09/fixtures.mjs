// Isolated synthetic data only. No production service or commercial seeds.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  createFixtures as createVenueRoots,
  money,
  timestamp,
  fixtureSql,
  requireOracle,
  reject,
} from '../step08/fixtures.mjs';
export { money, timestamp, fixtureSql, requireOracle, reject };
export const TEST_OWNER = 'SPORTIFY_STEP09_TEST_OWNER';
export const PAST = '2000-01-01T00:00:00.000000Z';
export const FUTURE = '2035-01-01T00:00:00.000000Z';
// Synthetic test data only: enough for claim + reclaim, never runtime policy.
export const FIXTURE_MAX_ATTEMPTS = 2;
export function assertTestOwner(owner) {
  assert.equal(owner, TEST_OWNER);
}

export function canonicalFixtureJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value));
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalFixtureJson).join(',') + ']';
  assert.ok(
    value && Object.getPrototypeOf(value) === Object.prototype,
    'Only validated plain fixture data.',
  );
  return (
    '{' +
    Object.keys(value)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + canonicalFixtureJson(value[key]))
      .join(',') +
    '}'
  );
}
export const fingerprint = (value) =>
  createHash('sha256').update(canonicalFixtureJson(value)).digest('hex');
export function fixtureReplay(record, claim) {
  assert.equal(record.scope, claim.scope, 'Harness scope conflict.');
  assert.equal(record.owner, claim.owner, 'Harness owner conflict.');
  if (record.fingerprint !== claim.fingerprint) return { kind: 'conflict' };
  if (record.state === 'COMPLETED') return { kind: 'replay', payload: record.payload };
  assert.equal(record.state, 'PROCESSING', 'Failed/unknown fixture state requires reconciliation.');
  return { kind: 'in_progress' };
}
const globalPrimary = {
  AUDIT_LOGS: 'AUDIT_LOG_ID',
  OUTBOX_EVENTS: 'OUTBOX_EVENT_ID',
  JOB_QUEUE: 'JOB_ID',
  IDEMPOTENCY_KEYS: 'IDEMPOTENCY_ID',
};
export async function createFixtures(session, owner, manifest) {
  assertTestOwner(owner);
  const f = await createVenueRoots(session, owner, manifest, {
    expectedOwner: TEST_OWNER,
    commitSetup: false,
  });
  const originalInsert = f.insert;
  f.globalRows = [];
  f.insert = async (table, values) => {
    const result = await originalInsert(table, values);
    if (globalPrimary[table] && values.TENANT_ID === null)
      f.globalRows.push({ table, id: values[globalPrimary[table]] });
    return result;
  };
  f.plan = f.id();
  f.theme = f.id();
  f.admin = f.id();
  f.planCode = 'S9_TEST_' + f.nonce.toUpperCase();
  f.themeCode = 'S9_THEME_' + f.nonce.toUpperCase();
  await f.insert('PLATFORM_ADMINS', {
    PLATFORM_ADMIN_ID: f.admin,
    USER_ID: f.a.user,
    ADMIN_ROLE_CODE: 'PLATFORM_ADMIN',
  });
  await f.insert('SUBSCRIPTION_PLANS', {
    PLAN_ID: f.plan,
    PLAN_CODE: f.planCode,
    PLAN_NAME: 'Synthetic plan metadata',
    PRICE_AMOUNT: money('1000.00'),
    CURRENCY_CODE: 'LKR',
    BILLING_INTERVAL: 'CUSTOM',
    TRIAL_DAYS: 0,
  });
  await f.insert('WEBSITE_THEMES', {
    THEME_ID: f.theme,
    THEME_CODE: f.themeCode,
    THEME_NAME: 'Synthetic test-only theme',
  });
  f.scope = (tenant) => ({
    SCOPE_KIND: tenant ? 'TENANT' : 'PLATFORM',
    TENANT_ID: tenant?.tenant ?? null,
  });
  f.subscriptionValues = (tenant = f.a, extra = {}) => ({
    SUBSCRIPTION_ID: f.id(),
    TENANT_ID: tenant.tenant,
    PLAN_ID: f.plan,
    SUBSCRIPTION_STATUS: 'ACTIVE',
    STARTS_AT_UTC: timestamp(PAST),
    ENDS_AT_UTC: timestamp(FUTURE),
    PLAN_NAME_SNAPSHOT: 'Synthetic plan metadata',
    PRICE_AMOUNT_SNAPSHOT: money('1000.00'),
    CURRENCY_CODE: 'LKR',
    BILLING_INTERVAL_SNAPSHOT: 'CUSTOM',
    ...extra,
  });
  f.subscriptions = [];
  for (const tenant of f.tenants) {
    const values = f.subscriptionValues(tenant);
    await f.insert('SUBSCRIPTIONS', values);
    f.subscriptions.push(values);
  }
  f.invoiceValues = (tenant = f.a, subscription = f.subscriptions[0], extra = {}) => ({
    SUBSCRIPTION_INVOICE_ID: f.id(),
    TENANT_ID: tenant.tenant,
    SUBSCRIPTION_ID: subscription.SUBSCRIPTION_ID,
    INVOICE_NUMBER: 'S9-' + f.nonce + '-' + f.id(),
    AMOUNT_DUE: money('1000.00'),
    CURRENCY_CODE: 'LKR',
    ISSUED_AT_UTC: timestamp(PAST),
    PERIOD_STARTS_AT_UTC: timestamp(PAST),
    PERIOD_ENDS_AT_UTC: timestamp(FUTURE),
    ...extra,
  });
  f.invoices = [];
  for (let i = 0; i < 2; i++) {
    const values = f.invoiceValues(f.tenants[i], f.subscriptions[i]);
    await f.insert('SUBSCRIPTION_INVOICES', values);
    f.invoices.push(values);
  }
  f.paymentValues = (tenant = f.a, invoice = f.invoices[0], extra = {}) => ({
    SUBSCRIPTION_PAYMENT_ID: f.id(),
    TENANT_ID: tenant.tenant,
    SUBSCRIPTION_INVOICE_ID: invoice.SUBSCRIPTION_INVOICE_ID,
    PAYMENT_METHOD: 'BANK_TRANSFER',
    AMOUNT: money('1000.00'),
    CURRENCY_CODE: 'LKR',
    RECEIVED_AT_UTC: timestamp(PAST),
    RECORDED_BY_USER_ID: f.a.user,
    RECORDED_BY_PLATFORM_ADMIN_ID: f.admin,
    PUBLIC_ID: randomUUID(),
    ...extra,
  });
  f.websiteValues = (tenant = f.a, extra = {}) => ({
    WEBSITE_ID: f.id(),
    TENANT_ID: tenant.tenant,
    BUSINESS_ID: tenant.business,
    THEME_ID: f.theme,
    SUBDOMAIN_SLUG: 's9-' + f.nonce + '-' + f.id(),
    PUBLIC_ID: randomUUID(),
    ...extra,
  });
  f.mediaValues = (tenant = f.a, extra = {}) => ({
    WEBSITE_MEDIA_ID: f.id(),
    TENANT_ID: tenant.tenant,
    BUSINESS_ID: tenant.business,
    OBJECT_KEY: 'test-' + f.nonce + '/' + f.id() + '.png',
    CONTENT_TYPE: 'image/png',
    SIZE_BYTES: 100,
    MEDIA_KIND: 'BUSINESS',
    PUBLIC_ID: randomUUID(),
    ...extra,
  });
  f.auditValues = (tenant = f.a, extra = {}) => ({
    AUDIT_LOG_ID: f.id(),
    ...f.scope(tenant),
    ACTOR_TYPE: tenant ? 'USER' : 'SYSTEM',
    ACTOR_USER_ID: tenant?.user ?? null,
    ACTOR_MEMBERSHIP_ID: tenant?.member ?? null,
    ACTOR_SERVICE: tenant ? null : 'sportify-step09-test',
    ACTION_CODE: 'TEST_CHANGE',
    ENTITY_TYPE: 'S9_FIXTURE',
    ENTITY_PUBLIC_ID: f.nonce,
    PUBLIC_ID: randomUUID(),
    AFTER_DATA: JSON.stringify({ testRun: f.nonce }),
    ...extra,
  });
  f.eventValues = (tenant = f.a, extra = {}) => ({
    OUTBOX_EVENT_ID: f.id(),
    ...f.scope(tenant),
    AGGREGATE_TYPE: 'S9_FIXTURE',
    AGGREGATE_ID: f.nonce,
    EVENT_TYPE: 'test.s9.changed',
    PAYLOAD: JSON.stringify({ testRun: f.nonce }),
    MAX_ATTEMPTS: FIXTURE_MAX_ATTEMPTS,
    CREATED_AT_UTC: timestamp(PAST),
    AVAILABLE_AT_UTC: timestamp(PAST),
    ...extra,
  });
  f.jobValues = (tenant = f.a, extra = {}) => ({
    JOB_ID: f.id(),
    ...f.scope(tenant),
    JOB_TYPE: 'test.s9.' + f.nonce,
    PAYLOAD: JSON.stringify({ testRun: f.nonce }),
    MAX_ATTEMPTS: FIXTURE_MAX_ATTEMPTS,
    CREATED_AT_UTC: timestamp(PAST),
    RUN_AFTER_UTC: timestamp(PAST),
    DEDUPE_KEY: 's9-' + f.nonce + '-' + f.id(),
    ...extra,
  });
  f.idemValues = (tenant = f.a, extra = {}) => ({
    IDEMPOTENCY_ID: f.id(),
    ...f.scope(tenant),
    OPERATION_SCOPE: 'test.s9.' + f.nonce,
    OWNER_TYPE: 'USER',
    OWNER_SCOPE: fingerprint({ testRun: f.nonce, owner: 'fixture-user' }),
    IDEMPOTENCY_KEY: randomUUID(),
    REQUEST_HASH: fingerprint({ testRun: f.nonce, amount: '1000.00' }),
    CREATED_AT_UTC: timestamp(PAST),
    EXPIRES_AT_UTC: timestamp(FUTURE),
    LEASE_TOKEN: randomUUID(),
    LEASE_EXPIRES_AT_UTC: timestamp(FUTURE),
    ...extra,
  });
  // Builders also track platform rows inserted by separate raw test sessions.
  for (const [method, table] of Object.entries({
    auditValues: 'AUDIT_LOGS',
    eventValues: 'OUTBOX_EVENTS',
    jobValues: 'JOB_QUEUE',
    idemValues: 'IDEMPOTENCY_KEYS',
  })) {
    const original = f[method];
    f[method] = (...args) => {
      const values = original(...args);
      if (values.TENANT_ID === null) f.globalRows.push({ table, id: values[globalPrimary[table]] });
      return values;
    };
  }
  await session.commit();
  return f;
}

export async function cleanupFixtures(session, owner, manifest, f) {
  assertTestOwner(owner);
  for (const tenant of f.tenants) {
    const root = (
      await session.execute(
        'SELECT PUBLIC_ID FROM TENANTS WHERE TENANT_ID=:p_id',
        { p_id: tenant.tenant },
        { outFormat: 4002 },
      )
    ).rows?.[0];
    assert.equal(root?.PUBLIC_ID, tenant.publicId, 'Exact synthetic root required before cleanup.');
  }
  // Delete only known global fixture IDs, in child-before-parent order. Every
  // surviving row must also carry this run marker; missing rolled-back IDs skip.
  for (const table of ['JOB_QUEUE', 'IDEMPOTENCY_KEYS', 'AUDIT_LOGS', 'OUTBOX_EVENTS']) {
    for (const row of f.globalRows.filter((row) => row.table === table)) {
      const markerColumn =
        table === 'JOB_QUEUE'
          ? 'JOB_TYPE'
          : table === 'IDEMPOTENCY_KEYS'
            ? 'OPERATION_SCOPE'
            : table === 'AUDIT_LOGS'
              ? 'ENTITY_PUBLIC_ID'
              : 'AGGREGATE_ID';
      const data = (
        await session.execute(
          `SELECT ${markerColumn} AS MARKER,SCOPE_KIND,TENANT_ID FROM ${table} WHERE ${globalPrimary[table]}=:p_id`,
          { p_id: row.id },
          { outFormat: 4002 },
        )
      ).rows?.[0];
      if (!data) continue;
      assert.equal(data.SCOPE_KIND, 'PLATFORM');
      assert.equal(data.TENANT_ID, null);
      assert.ok(data.MARKER?.includes(f.nonce));
      await session.execute(
        `DELETE FROM ${table} WHERE ${globalPrimary[table]}=:p_id`,
        { p_id: row.id },
        { autoCommit: false },
      );
    }
  }
  for (const table of manifest.migrations
    .flatMap((entry) => entry.tables)
    .filter((table) => table.columns.some((column) => column.name === 'TENANT_ID'))
    .reverse())
    await session.execute(
      `DELETE FROM ${table.name} WHERE TENANT_ID IN (:p_a,:p_b)`,
      { p_a: f.a.tenant, p_b: f.b.tenant },
      { autoCommit: false },
    );
  await session.execute(
    'DELETE FROM SUBSCRIPTION_ENTITLEMENTS WHERE PLAN_ID=:p_id',
    { p_id: f.plan },
    { autoCommit: false },
  );
  await session.execute(
    'DELETE FROM SUBSCRIPTION_PLANS WHERE PLAN_ID=:p_id AND PLAN_CODE=:p_code',
    { p_id: f.plan, p_code: f.planCode },
    { autoCommit: false },
  );
  await session.execute(
    'DELETE FROM WEBSITE_THEMES WHERE THEME_ID=:p_id AND THEME_CODE=:p_code',
    { p_id: f.theme, p_code: f.themeCode },
    { autoCommit: false },
  );
  await session.execute(
    'DELETE FROM PLATFORM_ADMINS WHERE PLATFORM_ADMIN_ID=:p_id AND USER_ID=:p_user',
    { p_id: f.admin, p_user: f.a.user },
    { autoCommit: false },
  );
  for (const tenant of f.tenants)
    await session.execute(
      'DELETE FROM USERS WHERE USER_ID=:p_id',
      { p_id: tenant.user },
      { autoCommit: false },
    );
  await session.commit();
}
