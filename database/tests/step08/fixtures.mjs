// Synthetic fixtures only, never application or migration execution code.
import assert from 'node:assert/strict';
import { randomUUID, randomInt } from 'node:crypto';

export const TEST_OWNER = 'SPORTIFY_STEP08_TEST_OWNER';
export const TIMESTAMP_FORMAT = 'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"';
export const START = '2035-01-02T08:00:00.000000Z';
export const END = '2035-01-02T09:00:00.000000Z';
export function assertTestOwner(owner) {
  assert.equal(owner, TEST_OWNER);
}
export const timestamp = (value) => ({ kind: 'timestamp', value });
export const money = (value) => ({ kind: 'money', value });

function epoch(value) {
  assert.match(value, /^\d{4}-\d\d-\d\dT\d\d:\d\d:00\.000000Z$/);
  const result = Date.parse(value.replace('.000000Z', '.000Z'));
  assert.ok(Number.isSafeInteger(result) && result % 900000 === 0);
  assert.equal(new Date(result).toISOString().replace('.000Z', '.000000Z'), value);
  return result;
}
export function slotStarts(start, end) {
  const first = epoch(start),
    last = epoch(end);
  assert.ok(last > first && last - first <= 86400000);
  return Array.from({ length: (last - first) / 900000 }, (_, i) =>
    new Date(first + i * 900000).toISOString().replace('.000Z', '.000000Z'),
  );
}
export function requireOracle(error, number, names = []) {
  assert.equal(
    error?.errorNum,
    number,
    'Expected a specific Oracle error, not a transport or fixture failure.',
  );
  if (names.length)
    assert.ok(
      names.some((name) => new RegExp('(?:^|[.("])' + name + '(?=[)"\\s]|$)').test(error.message)),
      'Expected registered constraint/index.',
    );
}
export async function reject(session, number, names, work) {
  await session.execute('SAVEPOINT S8_CASE');
  let error;
  try {
    await work();
  } catch (caught) {
    error = caught;
  } finally {
    await session.execute('ROLLBACK TO S8_CASE');
  }
  try {
    requireOracle(error, number, names);
  } catch (failure) {
    console.error(
      JSON.stringify({
        event: 'step08.constraint_mismatch',
        expectedOracle: number,
        expectedConstraints: names,
        actualOracle: Number.isInteger(error?.errorNum) ? error.errorNum : null,
      }),
    );
    throw failure;
  }
}

export function fixtureSql(manifest, table, values) {
  const declared = manifest.migrations
    .flatMap((entry) => entry.tables)
    .find((item) => item.name === table);
  assert.ok(declared, 'Only manifest-declared fixture tables allowed.');
  const columns = Object.keys(values);
  assert.ok(columns.every((name) => declared.columns.some((column) => column.name === name)));
  const binds = {},
    expressions = columns.map((column, index) => {
      const name = 'v' + index,
        value = values[column];
      if (value && typeof value === 'object') {
        assert.ok(['timestamp', 'money'].includes(value.kind));
        if (value.kind === 'timestamp') {
          assert.match(value.value, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/);
          binds[name] = value.value;
          return `TO_TIMESTAMP(:${name},'${TIMESTAMP_FORMAT}')`;
        }
        assert.match(value.value, /^-?\d{1,10}\.\d{2}$/);
        binds[name] = value.value;
        return `TO_NUMBER(:${name},'9999999990D99','NLS_NUMERIC_CHARACTERS=''.,''')`;
      }
      assert.ok(
        value === null ||
          typeof value === 'string' ||
          (typeof value === 'number' && Number.isSafeInteger(value)),
      );
      binds[name] = value;
      return ':' + name;
    });
  return {
    sql: `INSERT INTO ${table} (${columns.join(',')}) VALUES (${expressions.join(',')})`,
    binds,
  };
}

export async function createFixtures(
  session,
  owner,
  manifest,
  { expectedOwner = TEST_OWNER, commitSetup = true } = {},
) {
  // Shared synthetic venue roots, with explicit fixed disposable identities.
  // Default/Step 08 callers retain their original single-owner boundary.
  assert.ok([TEST_OWNER, 'SPORTIFY_STEP09_TEST_OWNER'].includes(expectedOwner));
  assert.equal(owner, expectedOwner);
  let serial = 9007199254741000n + BigInt(randomInt(1, 1000000)) * 10000n;
  const id = () => String(++serial),
    nonce = randomUUID().replaceAll('-', '').slice(0, 12);
  const insert = async (table, values) => {
    const statement = fixtureSql(manifest, table, values);
    return session.execute(statement.sql, statement.binds, { autoCommit: false });
  };
  const sport = (
    await session.execute(
      "SELECT TO_CHAR(SPORT_ID) AS ID FROM SPORTS WHERE SPORT_CODE='FUTSAL'",
      {},
      { outFormat: 4002 },
    )
  ).rows?.[0]?.ID;
  assert.ok(sport);
  const tenants = [];
  for (const label of ['a', 'b']) {
    const item = {
      tenant: id(),
      user: id(),
      member: id(),
      business: id(),
      location: id(),
      customer: id(),
      publicId: randomUUID(),
      resources: [],
    };
    await insert('TENANTS', {
      TENANT_ID: item.tenant,
      PUBLIC_ID: item.publicId,
      TENANT_CODE: `s8-${nonce}-${label}`,
      TENANT_NAME: 'Step 08 synthetic ' + label,
    });
    await insert('USERS', {
      USER_ID: item.user,
      PUBLIC_ID: randomUUID(),
      FULL_NAME: 'Synthetic staff',
      EMAIL: `s8-${nonce}-${label}@example.invalid`,
      EMAIL_NORMALIZED: `s8-${nonce}-${label}@example.invalid`,
      PASSWORD_HASH: 'synthetic-encoded-hash-no-login',
    });
    await insert('TENANT_USERS', {
      MEMBERSHIP_ID: item.member,
      TENANT_ID: item.tenant,
      USER_ID: item.user,
      PUBLIC_ID: randomUUID(),
      MEMBERSHIP_STATUS: 'ACTIVE',
    });
    await insert('BUSINESSES', {
      BUSINESS_ID: item.business,
      TENANT_ID: item.tenant,
      PUBLIC_ID: randomUUID(),
      BUSINESS_NAME: 'Synthetic venue',
      BUSINESS_SLUG: `s8-${nonce}-${label}`,
    });
    await insert('LOCATIONS', {
      LOCATION_ID: item.location,
      TENANT_ID: item.tenant,
      BUSINESS_ID: item.business,
      PUBLIC_ID: randomUUID(),
      LOCATION_CODE: 'TEST',
      LOCATION_NAME: 'Synthetic location',
      ADDRESS_LINE_1: 'Synthetic test address',
      CITY: 'Synthetic city',
    });
    await insert('BUSINESS_SPORTS', {
      TENANT_ID: item.tenant,
      BUSINESS_ID: item.business,
      SPORT_ID: sport,
    });
    for (let i = 0; i < (label === 'a' ? 2 : 1); i++) {
      const resource = { id: id(), price: id() };
      await insert('RESOURCES', {
        RESOURCE_ID: resource.id,
        TENANT_ID: item.tenant,
        BUSINESS_ID: item.business,
        LOCATION_ID: item.location,
        SPORT_ID: sport,
        PUBLIC_ID: randomUUID(),
        RESOURCE_CODE: 'COURT' + i,
        RESOURCE_NAME: 'Synthetic court',
        RESOURCE_TYPE: 'COURT',
      });
      await insert('PRICING_RULES', {
        PRICING_RULE_ID: resource.price,
        TENANT_ID: item.tenant,
        RESOURCE_ID: resource.id,
        PUBLIC_ID: randomUUID(),
        RULE_CODE: 'TEST',
        HOURLY_RATE: money('1000.00'),
        EFFECTIVE_FROM_UTC: timestamp('2030-01-01T00:00:00.000000Z'),
      });
      item.resources.push(resource);
    }
    await insert('CUSTOMERS', {
      CUSTOMER_ID: item.customer,
      TENANT_ID: item.tenant,
      PUBLIC_ID: randomUUID(),
      FULL_NAME: 'Synthetic customer',
      MOBILE_E164: '+99900000001',
      EMAIL: 'synthetic@example.invalid',
      EMAIL_NORMALIZED: 'synthetic@example.invalid',
    });
    tenants.push(item);
  }
  const [a, b] = tenants;
  const bookingValues = (tenant = a, extra = {}) => ({
    BOOKING_ID: id(),
    TENANT_ID: tenant.tenant,
    PUBLIC_ID: randomUUID(),
    BOOKING_REFERENCE: 'S8-' + nonce + '-' + id(),
    BUSINESS_ID: tenant.business,
    CUSTOMER_ID: tenant.customer,
    BOOKING_SOURCE: 'WALK_IN',
    CURRENCY_CODE: 'LKR',
    TOTAL_AMOUNT: money('1000.00'),
    CUSTOMER_NAME_SNAPSHOT: 'Synthetic customer',
    CUSTOMER_MOBILE_SNAPSHOT: '+99900000001',
    CREATED_BY_MEMBERSHIP_ID: tenant.member,
    CANCELLATION_POLICY_SNAPSHOT: 'Synthetic immutable cancellation policy',
    ...extra,
  });
  const holdValues = (tenant = a, extra = {}) => ({
    HOLD_ID: id(),
    TENANT_ID: tenant.tenant,
    PUBLIC_ID: randomUUID(),
    HOLD_TOKEN_HASH: randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', ''),
    CHECKOUT_SESSION_KEY: randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', ''),
    EXPIRES_AT_UTC: timestamp('2035-01-02T12:00:00.000000Z'),
    TOKEN_KEY_VERSION: 'synthetic-v1',
    CANCELLATION_POLICY_SNAPSHOT: 'Synthetic policy',
    ...extra,
  });
  const itemValues = (tenant = a, resource = tenant.resources[0], extra = {}) => ({
    TENANT_ID: tenant.tenant,
    BUSINESS_ID: tenant.business,
    LOCATION_ID: tenant.location,
    RESOURCE_ID: resource.id,
    STARTS_AT_UTC: timestamp(START),
    ENDS_AT_UTC: timestamp(END),
    DURATION_MINUTES: 60,
    HOURLY_RATE_SNAPSHOT: money('1000.00'),
    LINE_TOTAL: money('1000.00'),
    CURRENCY_CODE: 'LKR',
    BUFFER_BEFORE_MINUTES: 0,
    BUFFER_AFTER_MINUTES: 0,
    OCCUPIED_START_UTC: timestamp(START),
    OCCUPIED_END_UTC: timestamp(END),
    PRICING_RULE_ID: resource.price,
    ...extra,
  });
  const booking = async (
    tenant = a,
    resource = tenant.resources[0],
    extra = {},
    itemExtra = {},
  ) => {
    const header = bookingValues(tenant, extra);
    await insert('BOOKINGS', header);
    const item = {
      ...itemValues(tenant, resource, itemExtra),
      BOOKING_ITEM_ID: id(),
      BOOKING_ID: header.BOOKING_ID,
    };
    await insert('BOOKING_ITEMS', item);
    return {
      id: header.BOOKING_ID,
      item: item.BOOKING_ITEM_ID,
      tenant: tenant.tenant,
      resource: resource.id,
      header,
    };
  };
  const hold = async (tenant = a, resource = tenant.resources[0]) => {
    const header = holdValues(tenant);
    await insert('BOOKING_HOLDS', header);
    const item = { ...itemValues(tenant, resource), HOLD_ITEM_ID: id(), HOLD_ID: header.HOLD_ID };
    await insert('BOOKING_HOLD_ITEMS', item);
    return {
      id: header.HOLD_ID,
      item: item.HOLD_ITEM_ID,
      tenant: tenant.tenant,
      resource: resource.id,
      header,
    };
  };
  const slotSql = (ownerItem, time, type = 'booking') =>
    fixtureSql(manifest, 'RESOURCE_SLOT_RESERVATIONS', {
      TENANT_ID: ownerItem.tenant,
      RESOURCE_ID: ownerItem.resource,
      SLOT_START_UTC: timestamp(time),
      BOOKING_ITEM_ID: type === 'booking' ? ownerItem.item : null,
      HOLD_ITEM_ID: type === 'hold' ? ownerItem.item : null,
    });
  const slots = async (connection, ownerItem, times, type = 'booking') => {
    for (const time of times) {
      const statement = slotSql(ownerItem, time, type);
      await connection.execute(statement.sql, statement.binds, { autoCommit: false });
    }
  };
  // Committed only inside this verified disposable owner for independent sessions.
  if (commitSetup) await session.commit();
  return {
    a,
    b,
    tenants,
    id,
    nonce,
    insert,
    bookingValues,
    holdValues,
    itemValues,
    booking,
    hold,
    slots,
    slotSql,
  };
}

export async function cleanupFixtures(session, owner, manifest, fixtures) {
  assertTestOwner(owner);
  // Require the exact created root identities before deleting any fixture data.
  for (const tenant of fixtures.tenants) {
    const rows = (
      await session.execute(
        'SELECT PUBLIC_ID FROM TENANTS WHERE TENANT_ID=:id',
        { id: tenant.tenant },
        { outFormat: 4002 },
      )
    ).rows;
    assert.equal(rows?.[0]?.PUBLIC_ID, tenant.publicId);
  }
  const tables = manifest.migrations
    .flatMap((entry) => entry.tables)
    .filter((table) => table.columns.some((column) => column.name === 'TENANT_ID'))
    .reverse();
  for (const table of tables) {
    // Creation phases have acyclic parent dependencies; USER_ROLES etc are empty.
    await session.execute(
      `DELETE FROM ${table.name} WHERE TENANT_ID IN (:a,:b)`,
      { a: fixtures.a.tenant, b: fixtures.b.tenant },
      { autoCommit: false },
    );
  }
  for (const tenant of fixtures.tenants)
    await session.execute(
      'DELETE FROM USERS WHERE USER_ID=:id',
      { id: tenant.user },
      { autoCommit: false },
    );
  await session.commit();
}
