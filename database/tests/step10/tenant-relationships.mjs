import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import oracledb from 'oracledb';
import { createFixtures, PAST, FUTURE } from '../step09/fixtures.mjs';
import {
  END,
  START,
  fixtureSql,
  fixtureValues,
  money,
  reject,
  timestamp,
} from '../step08/fixtures.mjs';
import { CLEAN_OWNER } from './config.mjs';

const scopes = ['TENANT_ID', 'ACTIVE_TENANT_ID'];
const digest = () => randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
const tenantColumn = (fk) => fk.columns.find((column) => scopes.includes(column));
const eventScope = 'FK_JOB_EVENT_SCOPE';
export function requiredTenantColumn(table) {
  return table.columns.find(
    (column) => column.name === 'TENANT_ID' && !column.nullable && !column.identity,
  );
}
const partialRelationships = {
  AUTH_SESSIONS: ['ACTIVE_TENANT_ID', 'CK_SESSION_MEMBER_PAIR'],
  WEBSITE_MEDIA: ['LOCATION_ID', 'CK_WEBSITE_MEDIA_OWNER'],
  JOB_QUEUE: ['CONSUMER_CODE', 'CK_JOB_SOURCE_PAIR'],
  PAYMENTS: ['VOIDED_BY_MEMBERSHIP_ID', 'CK_PAYMENTS_VOID'],
  AUDIT_LOGS: ['ACTOR_USER_ID', 'CK_AUDIT_ACTOR'],
};
const resourceLocationRelationships = {
  BOOKING_ITEMS: 'FK_BOOKING_ITEMS_RESOURCE',
  BOOKING_HOLD_ITEMS: 'FK_BOOKING_HOLD_ITEMS_RESOURCE',
  WEBSITE_MEDIA: 'FK_WEBSITE_MEDIA_RESOURCE',
  OPERATING_HOURS: 'FK_OPERATING_HOURS_RESOURCE',
  AVAILABILITY_BLOCKS: 'FK_AVAIL_RESOURCE',
};

export async function collectTenantFixtures(session, manifest) {
  const rows = new Map();
  const capture = (table, values) => {
    if (!rows.has(table)) rows.set(table, []);
    rows.get(table).push(values);
  };
  const f = await createFixtures(session, CLEAN_OWNER, manifest, {
    expectedOwner: CLEAN_OWNER,
    capture,
  });
  const permission = (
    await session.execute(
      "SELECT TO_CHAR(PERMISSION_ID) FROM PERMISSIONS WHERE PERMISSION_CODE='business.read'",
    )
  ).rows[0][0];
  for (const [index, tenant] of f.tenants.entries()) {
    const scope = { TENANT_ID: tenant.tenant };
    const business = { ...scope, BUSINESS_ID: tenant.business };
    const location = { ...scope, LOCATION_ID: tenant.location };
    const resource = { ...location, RESOURCE_ID: tenant.resources[0].id };
    const role = f.id();
    const invitation = f.id();
    if (index === 0) {
      f.otherLocation = f.id();
      capture('LOCATIONS', {
        ...business,
        LOCATION_ID: f.otherLocation,
        LOCATION_CODE: 'SECOND',
        LOCATION_NAME: 'Synthetic second location',
        ADDRESS_LINE_1: 'Synthetic test address',
        CITY: 'Synthetic city',
        PUBLIC_ID: randomUUID(),
      });
      const alternate = await f.booking(
        tenant,
        tenant.resources[0],
        { CURRENCY_CODE: 'USD' },
        { CURRENCY_CODE: 'USD' },
      );
      f.otherBooking = alternate.id;
      f.otherPayment = f.id();
      capture('PAYMENTS', {
        ...scope,
        PAYMENT_ID: f.otherPayment,
        BOOKING_ID: alternate.id,
        PAYMENT_METHOD: 'CASH',
        AMOUNT: money('1000.00'),
        CURRENCY_CODE: 'USD',
        RECEIVED_AT_UTC: timestamp(START),
        RECORDED_BY_MEMBERSHIP_ID: tenant.member,
        PUBLIC_ID: randomUUID(),
      });
    }
    capture('TENANT_USERS', {
      ...scope,
      MEMBERSHIP_ID: f.id(),
      USER_ID: (() => {
        const id = f.id();
        const email = `s10-${f.nonce}-${index}@example.invalid`;
        capture('USERS', {
          USER_ID: id,
          PUBLIC_ID: randomUUID(),
          FULL_NAME: 'Synthetic inviter fixture',
          EMAIL: email,
          EMAIL_NORMALIZED: email,
          PASSWORD_HASH: 'synthetic-hash-no-login',
        });
        return id;
      })(),
      PUBLIC_ID: randomUUID(),
      INVITED_BY_MEMBERSHIP_ID: tenant.member,
    });
    capture('ROLES', { ...scope, ROLE_ID: role, ROLE_CODE: 'TEST', ROLE_NAME: 'Synthetic role' });
    capture('ROLE_PERMISSIONS', { ...scope, ROLE_ID: role, PERMISSION_ID: permission });
    capture('USER_ROLES', {
      ...scope,
      ROLE_ID: role,
      MEMBERSHIP_ID: tenant.member,
      ASSIGNED_BY_MEMBERSHIP_ID: tenant.member,
    });
    capture('BUSINESS_PROFILES', business);
    capture('AUTH_SESSIONS', {
      SESSION_ID: f.id(),
      USER_ID: tenant.user,
      TOKEN_HASH: digest(),
      EXPIRES_AT_UTC: timestamp(FUTURE),
      AUDIENCE: 'DASHBOARD',
      ACTIVE_TENANT_ID: tenant.tenant,
      ACTIVE_MEMBERSHIP_ID: tenant.member,
    });
    capture('RESOURCE_FEATURES', {
      ...scope,
      RESOURCE_ID: resource.RESOURCE_ID,
      FEATURE_CODE: 'TEST',
      FEATURE_NAME: 'Synthetic feature',
    });
    capture('STAFF_ASSIGNMENTS', {
      ...location,
      MEMBERSHIP_ID: tenant.member,
      PUBLIC_ID: randomUUID(),
    });
    const email = `invite-${f.nonce}-${index}@example.invalid`;
    capture('TENANT_INVITATIONS', {
      ...scope,
      INVITATION_ID: invitation,
      EMAIL: email,
      EMAIL_NORMALIZED: email,
      ROLE_ID: role,
      TOKEN_HASH: digest(),
      INVITED_BY_MEMBERSHIP_ID: tenant.member,
      EXPIRES_AT_UTC: timestamp(FUTURE),
      PUBLIC_ID: randomUUID(),
      TOKEN_KEY_VERSION: 'synthetic-v1',
    });
    capture('INVITATION_LOCATIONS', { ...location, INVITATION_ID: invitation });
    capture('OPERATING_HOURS', {
      ...resource,
      DAY_OF_WEEK: 1,
      OPEN_MINUTE: 480,
      CLOSE_MINUTE: 540,
      PUBLIC_ID: randomUUID(),
    });
    capture('HOLIDAYS', {
      ...location,
      HOLIDAY_DATE: { kind: 'date', value: '2035-01-02' },
      HOLIDAY_NAME: 'Synthetic holiday',
      PUBLIC_ID: randomUUID(),
    });
    capture('AVAILABILITY_BLOCKS', {
      ...resource,
      STARTS_AT_UTC: timestamp(START),
      ENDS_AT_UTC: timestamp(END),
      BLOCK_TYPE: 'MAINTENANCE',
      CREATED_BY_MEMBERSHIP_ID: tenant.member,
      PUBLIC_ID: randomUUID(),
    });
    capture('BUSINESS_PAYMENT_SETTINGS', business);
    const hold = await f.hold(tenant);
    const booking = await f.booking(tenant, tenant.resources[0], { SOURCE_HOLD_ID: hold.id });
    capture('RESOURCE_SLOT_RESERVATIONS', {
      ...scope,
      RESOURCE_ID: resource.RESOURCE_ID,
      SLOT_START_UTC: timestamp(START),
      BOOKING_ITEM_ID: booking.item,
      HOLD_ITEM_ID: null,
    });
    capture('RESOURCE_SLOT_RESERVATIONS', {
      ...scope,
      RESOURCE_ID: resource.RESOURCE_ID,
      SLOT_START_UTC: timestamp('2035-01-02T08:15:00.000000Z'),
      BOOKING_ITEM_ID: null,
      HOLD_ITEM_ID: hold.item,
    });
    capture('BOOKING_CANCELLATIONS', {
      ...scope,
      BOOKING_ID: booking.id,
      CANCELLED_BY_MEMBERSHIP_ID: tenant.member,
      CANCELLATION_REASON: 'Synthetic cancellation',
    });
    const payment = f.id();
    capture('PAYMENTS', {
      ...scope,
      PAYMENT_ID: payment,
      BOOKING_ID: booking.id,
      PAYMENT_METHOD: 'CASH',
      PAYMENT_STATUS: 'VOIDED',
      AMOUNT: money('1000.00'),
      CURRENCY_CODE: 'LKR',
      RECEIVED_AT_UTC: timestamp(START),
      RECORDED_BY_MEMBERSHIP_ID: tenant.member,
      PUBLIC_ID: randomUUID(),
      VOIDED_AT_UTC: timestamp(END),
      VOID_REASON: 'Synthetic void',
      VOIDED_BY_MEMBERSHIP_ID: tenant.member,
    });
    capture('REFUNDS', {
      ...scope,
      PAYMENT_ID: payment,
      AMOUNT: money('1000.00'),
      CURRENCY_CODE: 'LKR',
      REFUND_STATUS: 'REQUESTED',
      REFUND_REASON: 'Synthetic refund',
      RECORDED_BY_MEMBERSHIP_ID: tenant.member,
      PUBLIC_ID: randomUUID(),
    });
    capture('SUBSCRIPTION_FEATURE_SNAPSHOTS', {
      ...scope,
      SUBSCRIPTION_ID: f.subscriptions[index].SUBSCRIPTION_ID,
      FEATURE_CODE: 'SYNTHETIC',
      IS_ENABLED: 'Y',
      VALUE_KIND: 'BOOLEAN',
    });
    capture('SUBSCRIPTION_PAYMENTS', f.paymentValues(tenant, f.invoices[index]));
    capture('WEBSITE_SETTINGS', f.websiteValues(tenant));
    capture('WEBSITE_MEDIA', f.mediaValues(tenant, { ...resource, MEDIA_KIND: 'RESOURCE' }));
    capture('AUDIT_LOGS', f.auditValues(tenant));
    const event = f.eventValues(tenant);
    capture('OUTBOX_EVENTS', event);
    capture(
      'JOB_QUEUE',
      f.jobValues(tenant, {
        SOURCE_OUTBOX_EVENT_ID: event.OUTBOX_EVENT_ID,
        CONSUMER_CODE: `step10.consumer.${index}`,
        RUN_AFTER_UTC: timestamp(PAST),
      }),
    );
    capture('IDEMPOTENCY_KEYS', f.idemValues(tenant));
  }
  return { rows, f };
}

export async function verifyTenantRelationships(session, manifest, record) {
  const { rows, f } = await collectTenantFixtures(session, manifest);
  const constraints = manifest.migrations.flatMap((entry) => entry.constraints);
  const foreign = constraints.filter((constraint) => constraint.type === 'R');
  const required = foreign.filter((fk) => tenantColumn(fk) || fk.name === eventScope);
  const tables = new Map(
    manifest.migrations.flatMap((entry) => entry.tables).map((table) => [table.name, table]),
  );
  const covered = new Set();
  const insert = (table, values) => {
    const { sql, binds } = fixtureSql(manifest, table, values);
    return session.execute(sql, binds, { autoCommit: false });
  };
  const predicates = (parts) =>
    parts.columns.map((column, n) => `${column}=${parts.expressions[n]}`);

  async function missingParent(fk, values) {
    const tuple = Object.fromEntries(
      fk.referencedColumns.map((column, n) => [column, values[fk.columns[n]]]),
    );
    if (Object.values(tuple).some((value) => value == null)) return false;
    const parts = fixtureValues(manifest, fk.referencedTable, tuple);
    const result = await session.execute(
      `SELECT 1 FROM ${fk.referencedTable} WHERE ${predicates(parts).join(' AND ')} AND ROWNUM=1`,
      parts.binds,
    );
    return result.rows.length === 0;
  }

  async function verifyGeneratedTenantId() {
    const first = rows.get('TENANTS')[0];
    await session.execute('SAVEPOINT S10_IDENTITY');
    try {
      await insert('TENANTS', { ...first, TENANT_ID: null });
      const { rows: generated } = await session.execute(
        'SELECT TO_CHAR(TENANT_ID) FROM TENANTS WHERE PUBLIC_ID=:publicId',
        { publicId: first.PUBLIC_ID },
      );
      assert.equal(generated.length, 1);
      assert.match(generated[0][0], /^[1-9]\d*$/);
      assert.notEqual(generated[0][0], first.TENANT_ID);
    } finally {
      await session.execute('ROLLBACK TO S10_IDENTITY');
    }
    record('tenant.root-default-on-null-identity', 'PASS');
  }

  let activeTable;
  try {
    await verifyGeneratedTenantId();
    // Constraints in each applied phase name parents from the same or earlier
    // phases. Defer a table until all of its fixture parents are present.
    while (rows.size) {
      const next = [...rows.keys()].find(
        (table) =>
          !foreign.some(
            (fk) =>
              fk.table === table && fk.referencedTable !== table && rows.has(fk.referencedTable),
          ),
      );
      assert.ok(next, 'Fixture dependency cycle.');
      activeTable = next;
      const candidates = rows.get(next);
      const attached = foreign.filter((fk) => fk.table === next);
      for (const original of candidates) {
        const cases = [];
        for (const fk of attached.filter(tenantColumn)) {
          const scope = tenantColumn(fk);
          if (
            original[scope] !== f.a.tenant ||
            fk.columns.some((column) => original[column] == null)
          )
            continue;
          const twin = candidates.find(
            (row) => row[scope] === f.b.tenant && fk.columns.every((column) => row[column] != null),
          );
          assert.ok(twin, `Missing tenant B fixture for ${fk.name}.`);
          const patch =
            fk.columns.length === 1
              ? { [scope]: f.id() }
              : Object.fromEntries(
                  fk.columns
                    .filter((column) => column !== scope)
                    .map((column) => [column, twin[column]]),
                );
          const corrupted = { ...original, ...patch };
          const causal = [];
          for (const sibling of attached)
            if (await missingParent(sibling, corrupted)) causal.push(sibling.name);
          assert.ok(causal.includes(fk.name), `Fixture does not break ${fk.name}.`);
          await reject(session, 2291, causal, () => insert(next, corrupted));
          cases.push({
            name: fk.name,
            patch,
            causal,
            number: 2291,
            kind: fk.columns.length === 1 ? 'missing-tenant' : 'cross-tenant',
          });
        }
        if ((original.TENANT_ID ?? original.ACTIVE_TENANT_ID) === f.a.tenant) {
          if (next === 'JOB_QUEUE') {
            cases.push({
              name: eventScope,
              patch: { TENANT_ID: null, SCOPE_KIND: 'PLATFORM' },
              causal: [eventScope],
              number: 2291,
              kind: 'scope-mismatch',
            });
          }
          const partial = partialRelationships[next];
          if (partial && original[partial[0]] != null) {
            const [column, constraint] = partial;
            cases.push({
              name: constraint,
              patch: { [column]: null },
              causal:
                next === 'AUDIT_LOGS' ? [constraint, 'CK_AUDIT_LOGS_MEMBERSHIP'] : [constraint],
              number: 2290,
              kind: 'partial-relationship',
            });
          }
          const requiredScope = requiredTenantColumn(tables.get(next));
          if (requiredScope) {
            cases.push({
              name: requiredScope.name,
              patch: { TENANT_ID: null },
              causal: [],
              number: 1400,
              updateNumber: 1407,
              kind: 'required-tenant',
            });
          }
          const locationConstraint = resourceLocationRelationships[next];
          if (locationConstraint) {
            cases.push({
              name: locationConstraint,
              patch: { LOCATION_ID: f.otherLocation },
              causal: [locationConstraint],
              number: 2291,
              kind: 'same-tenant-resource-location',
            });
          }
          if (original.CURRENCY_CODE === 'LKR' && ['PAYMENTS', 'REFUNDS'].includes(next)) {
            const payments = next === 'PAYMENTS';
            const name = payments ? 'FK_PAYMENTS_BOOKING' : 'FK_REFUNDS_PAYMENT';
            cases.push({
              name,
              patch: payments ? { BOOKING_ID: f.otherBooking } : { PAYMENT_ID: f.otherPayment },
              causal: [name],
              number: 2291,
              kind: 'same-tenant-currency-parent',
            });
          }
        }
        for (const item of cases.filter(
          ({ kind }) => !['cross-tenant', 'missing-tenant'].includes(kind),
        )) {
          await reject(session, item.number, item.causal, () =>
            insert(next, { ...original, ...item.patch }),
          );
        }
        // RETURNING ROWID locates the exact valid row even when its primary
        // identity is generated or composite. No child fixture exists yet.
        const { sql, binds } = fixtureSql(manifest, next, original);
        if (!cases.length) {
          await insert(next, original);
          continue;
        }
        const inserted = await session.execute(
          `${sql} RETURNING ROWID INTO :rid`,
          { ...binds, rid: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 256 } },
          { autoCommit: false },
        );
        const rid = inserted.outBinds.rid[0];
        for (const { name, patch, causal, number, updateNumber, kind } of cases) {
          const parts = fixtureValues(manifest, next, patch);
          await reject(session, updateNumber ?? number, causal, () =>
            session.execute(
              `UPDATE ${next} SET ${predicates(parts).join(',')} WHERE ROWID=:rid`,
              { ...parts.binds, rid },
              { autoCommit: false },
            ),
          );
          if (number === 2291) covered.add(name);
          record(number === 2291 ? 'tenant.foreign-key' : 'tenant.nullability', 'PASS', {
            table: next,
            constraint: name,
            insert: true,
            update: true,
            causal,
            kind,
          });
        }
      }
      rows.delete(next);
    }
    assert.deepEqual([...covered].sort(), required.map((fk) => fk.name).sort());
  } catch (error) {
    record('tenant.fixture-phase', 'FAIL', {
      table: activeTable ?? 'TENANTS',
      oracle: Number.isInteger(error?.errorNum) ? error.errorNum : null,
    });
    throw error;
  } finally {
    await session.rollback();
  }
}
