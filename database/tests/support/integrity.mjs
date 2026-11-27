// Synthetic DML fixtures in an expressly disposable owner only. All DML rolls
// back before the runner proceeds to any DDL/failure-recovery fixtures.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyIntegrity(session, owner, manifest) {
  assert.ok(['SPORTIFY_TEST_OWNER', 'SPORTIFY_STEP10_CLEAN_OWNER'].includes(owner));
  const tables = new Map(
    manifest.migrations.flatMap((entry) => entry.tables).map((table) => [table.name, table]),
  );
  let next = 9007199254741000n;
  const id = () => String(++next);
  async function insert(table, values, expressions = {}) {
    assert.ok(tables.has(table));
    const allowed = new Set(tables.get(table).columns.map((column) => column.name));
    const keys = [...Object.keys(values), ...Object.keys(expressions)];
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(keys.every((key) => allowed.has(key)));
    const binds = Object.fromEntries(
      Object.keys(values).map((key, index) => [`v${index}`, values[key]]),
    );
    const sqlValues = [
      ...Object.keys(values).map((_, index) => `:v${index}`),
      ...Object.values(expressions),
    ];
    await session.execute(
      `INSERT INTO ${table} (${keys.join(',')}) VALUES (${sqlValues.join(',')})`,
      binds,
      { autoCommit: false },
    );
  }
  let cases = 0;
  async function reject(errorNumber, constraints, work) {
    await session.execute('SAVEPOINT S7_INTEGRITY_CASE');
    let caught;
    try {
      await work();
    } catch (error) {
      caught = error;
    } finally {
      await session.execute('ROLLBACK TO S7_INTEGRITY_CASE');
    }
    assert.equal(
      caught?.errorNum,
      errorNumber,
      'Expected the specific Oracle integrity error, not connection failure.',
    );
    assert.ok(
      constraints.some((name) =>
        new RegExp('(?:^|[.("])' + name + '(?=[)"\\s]|$)').test(caught.message),
      ),
      'Expected the registered named constraint.',
    );
    cases++;
  }
  let cleanupFailed = false;
  try {
    const a = {
      tenant: id(),
      user: id(),
      member: id(),
      role: id(),
      business: id(),
      location: id(),
      resource: id(),
    };
    const b = {
      tenant: id(),
      user: id(),
      member: id(),
      role: id(),
      business: id(),
      location: id(),
      resource: id(),
    };
    const sports = (
      await session.execute(
        "SELECT TO_CHAR(SPORT_ID) AS ID FROM SPORTS WHERE SPORT_CODE='FUTSAL'",
        {},
        { outFormat: 4002 },
      )
    ).rows;
    const permissions = (
      await session.execute(
        "SELECT TO_CHAR(PERMISSION_ID) AS ID FROM PERMISSIONS WHERE PERMISSION_CODE='business.read'",
        {},
        { outFormat: 4002 },
      )
    ).rows;
    assert.equal(sports?.length, 1);
    assert.equal(permissions?.length, 1);
    const sport = sports[0].ID,
      permission = permissions[0].ID;
    for (const [label, item] of [
      ['a', a],
      ['b', b],
    ]) {
      await insert('TENANTS', {
        TENANT_ID: item.tenant,
        PUBLIC_ID: randomUUID(),
        TENANT_CODE: `s7-${label}`,
        TENANT_NAME: `Step 07 synthetic ${label}`,
      });
      await insert('USERS', {
        USER_ID: item.user,
        PUBLIC_ID: randomUUID(),
        FULL_NAME: `Synthetic user ${label}`,
        EMAIL: `s7-${label}@example.invalid`,
        EMAIL_NORMALIZED: `s7-${label}@example.invalid`,
        PASSWORD_HASH:
          '$argon2id$v=19$m=65536,t=3,p=1$c3ludGhldGljc2FsdA$c3ludGhldGljaGFzaGZpeHR1cmU',
      });
      await insert('TENANT_USERS', {
        MEMBERSHIP_ID: item.member,
        TENANT_ID: item.tenant,
        USER_ID: item.user,
        PUBLIC_ID: randomUUID(),
        MEMBERSHIP_STATUS: 'ACTIVE',
      });
      await insert('ROLES', {
        ROLE_ID: item.role,
        TENANT_ID: item.tenant,
        ROLE_CODE: 'STAFF',
        ROLE_NAME: 'Synthetic staff',
      });
      await insert('BUSINESSES', {
        BUSINESS_ID: item.business,
        TENANT_ID: item.tenant,
        PUBLIC_ID: randomUUID(),
        BUSINESS_NAME: `Synthetic business ${label}`,
        BUSINESS_SLUG: `s7-business-${label}`,
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
      await insert('RESOURCES', {
        RESOURCE_ID: item.resource,
        TENANT_ID: item.tenant,
        BUSINESS_ID: item.business,
        LOCATION_ID: item.location,
        SPORT_ID: sport,
        PUBLIC_ID: randomUUID(),
        RESOURCE_CODE: 'COURT',
        RESOURCE_NAME: 'Synthetic court',
        RESOURCE_TYPE: 'COURT',
      });
    }
    const rolePermission = { TENANT_ID: a.tenant, ROLE_ID: a.role, PERMISSION_ID: permission };
    const memberRole = { TENANT_ID: a.tenant, MEMBERSHIP_ID: a.member, ROLE_ID: a.role };
    await insert('ROLE_PERMISSIONS', rolePermission);
    await insert('USER_ROLES', memberRole);
    await reject(2290, ['CK_TENANTS_UUID'], () =>
      insert('TENANTS', {
        TENANT_ID: id(),
        PUBLIC_ID: 'not-a-uuid',
        TENANT_CODE: 's7-invalid-uuid',
        TENANT_NAME: 'Synthetic invalid UUID',
      }),
    );
    await reject(2290, ['CK_TENANTS_ID_POSITIVE'], () =>
      insert('TENANTS', {
        TENANT_ID: '0',
        PUBLIC_ID: randomUUID(),
        TENANT_CODE: 's7-invalid-id',
        TENANT_NAME: 'Synthetic invalid ID',
      }),
    );
    await reject(1, ['UQ_TENANT_USERS_TENANT_USER'], () =>
      insert('TENANT_USERS', {
        MEMBERSHIP_ID: id(),
        TENANT_ID: a.tenant,
        USER_ID: a.user,
        PUBLIC_ID: randomUUID(),
      }),
    );
    await reject(1, ['PK_ROLE_PERMISSIONS'], () => insert('ROLE_PERMISSIONS', rolePermission));
    await reject(1, ['PK_USER_ROLES'], () => insert('USER_ROLES', memberRole));
    await reject(2291, ['FK_USER_ROLES_ROLE'], () =>
      insert('USER_ROLES', { ...memberRole, ROLE_ID: b.role }),
    );
    await reject(2291, ['FK_USER_ROLES_MEMBERSHIP'], () =>
      insert('USER_ROLES', { ...memberRole, MEMBERSHIP_ID: b.member }),
    );
    await reject(2291, ['FK_ROLE_PERMISSIONS_ROLE'], () =>
      insert('ROLE_PERMISSIONS', { ...rolePermission, ROLE_ID: b.role }),
    );
    await reject(1, ['UQ_ROLES_TENANT_NAME'], () =>
      insert('ROLES', {
        ROLE_ID: id(),
        TENANT_ID: a.tenant,
        ROLE_CODE: 'OTHER',
        ROLE_NAME: 'Synthetic staff',
      }),
    );
    await reject(1, ['UQ_BUSINESSES_ONE_PER_TENANT'], () =>
      insert('BUSINESSES', {
        BUSINESS_ID: id(),
        TENANT_ID: a.tenant,
        PUBLIC_ID: randomUUID(),
        BUSINESS_NAME: 'Duplicate tenant business',
        BUSINESS_SLUG: 's7-duplicate-business',
      }),
    );
    await reject(1, ['UQ_USERS_EMAIL_NORMALIZED'], () =>
      insert('USERS', {
        USER_ID: id(),
        PUBLIC_ID: randomUUID(),
        FULL_NAME: 'Duplicate synthetic account',
        EMAIL: 'S7-A@example.invalid',
        EMAIL_NORMALIZED: 's7-a@example.invalid',
        PASSWORD_HASH: 'synthetic-encoded-hash-only',
      }),
    );

    const staff = {
      STAFF_ASSIGNMENT_ID: id(),
      TENANT_ID: a.tenant,
      MEMBERSHIP_ID: a.member,
      LOCATION_ID: a.location,
      PUBLIC_ID: randomUUID(),
    };
    await insert('STAFF_ASSIGNMENTS', staff);
    await reject(2291, ['FK_STAFF_MEMBER'], () =>
      insert('STAFF_ASSIGNMENTS', {
        ...staff,
        STAFF_ASSIGNMENT_ID: id(),
        PUBLIC_ID: randomUUID(),
        MEMBERSHIP_ID: b.member,
      }),
    );
    await reject(2291, ['FK_STAFF_ASSIGNMENTS_LOCATION'], () =>
      insert('STAFF_ASSIGNMENTS', {
        ...staff,
        STAFF_ASSIGNMENT_ID: id(),
        PUBLIC_ID: randomUUID(),
        LOCATION_ID: b.location,
      }),
    );
    const resource = {
      RESOURCE_ID: id(),
      TENANT_ID: a.tenant,
      BUSINESS_ID: a.business,
      LOCATION_ID: a.location,
      SPORT_ID: sport,
      PUBLIC_ID: randomUUID(),
      RESOURCE_CODE: 'OTHER',
      RESOURCE_NAME: 'Synthetic court',
      RESOURCE_TYPE: 'COURT',
    };
    await reject(2291, ['FK_RESOURCES_LOCATION'], () =>
      insert('RESOURCES', { ...resource, LOCATION_ID: b.location }),
    );
    await reject(2290, ['CK_RESOURCES_STATUS'], () =>
      insert('RESOURCES', { ...resource, RESOURCE_STATUS: 'INVALID' }),
    );
    await reject(2290, ['CK_RESOURCES_BOOKABLE'], () =>
      insert('RESOURCES', { ...resource, IS_BOOKABLE: 'X' }),
    );
    await reject(2290, ['CK_RESOURCE_BUFFERS'], () =>
      insert('RESOURCES', { ...resource, BUFFER_BEFORE_MINUTES: 7 }),
    );

    const expiration = { EXPIRES_AT_UTC: "LOCALTIMESTAMP + INTERVAL '1' DAY" };
    const auth = {
      SESSION_ID: id(),
      USER_ID: a.user,
      TOKEN_HASH: 'a'.repeat(64),
      AUDIENCE: 'DASHBOARD',
      ACTIVE_TENANT_ID: a.tenant,
      ACTIVE_MEMBERSHIP_ID: a.member,
    };
    await insert('AUTH_SESSIONS', auth, expiration);
    await reject(2290, ['CK_SESSION_MEMBER_PAIR'], () =>
      insert(
        'AUTH_SESSIONS',
        { ...auth, SESSION_ID: id(), TOKEN_HASH: 'b'.repeat(64), ACTIVE_MEMBERSHIP_ID: null },
        expiration,
      ),
    );
    await reject(2290, ['CK_SESSION_MEMBER_PAIR'], () =>
      insert(
        'AUTH_SESSIONS',
        { ...auth, SESSION_ID: id(), TOKEN_HASH: 'b'.repeat(64), AUDIENCE: 'ADMIN' },
        expiration,
      ),
    );
    await reject(2291, ['FK_SESSION_ACTIVE_MEMBER'], () =>
      insert(
        'AUTH_SESSIONS',
        { ...auth, SESSION_ID: id(), TOKEN_HASH: 'b'.repeat(64), USER_ID: b.user },
        expiration,
      ),
    );
    const constraints = manifest.migrations.flatMap((entry) => entry.constraints);
    for (const [table, idColumn] of [
      ['EMAIL_VERIFICATION_TOKENS', 'VERIFICATION_ID'],
      ['PASSWORD_RESET_TOKENS', 'RESET_ID'],
    ]) {
      const token = {
        [idColumn]: id(),
        USER_ID: a.user,
        TOKEN_HASH: 'd'.repeat(64),
        PUBLIC_ID: randomUUID(),
        TOKEN_KEY_VERSION: 'synthetic-v1',
      };
      await insert(table, token, expiration);
      const hashKey = constraints.find(
        (key) => key.table === table && key.type === 'U' && key.columns.join(',') === 'TOKEN_HASH',
      );
      const expiry = constraints.find(
        (key) =>
          key.table === table &&
          key.type === 'C' &&
          key.expression
            .replaceAll(/\s/g, '')
            .toUpperCase()
            .includes('EXPIRES_AT_UTC>CREATED_AT_UTC'),
      );
      assert.ok(hashKey && expiry);
      await reject(1, [hashKey.name], () =>
        insert(table, { ...token, [idColumn]: id(), PUBLIC_ID: randomUUID() }, expiration),
      );
      await reject(2290, [expiry.name], () =>
        insert(
          table,
          { ...token, [idColumn]: id(), PUBLIC_ID: randomUUID(), TOKEN_HASH: 'e'.repeat(64) },
          { EXPIRES_AT_UTC: "LOCALTIMESTAMP - INTERVAL '1' DAY" },
        ),
      );
    }

    const invitation = id();
    await insert(
      'TENANT_INVITATIONS',
      {
        INVITATION_ID: invitation,
        TENANT_ID: a.tenant,
        EMAIL: 's7-invite@example.invalid',
        EMAIL_NORMALIZED: 's7-invite@example.invalid',
        ROLE_ID: a.role,
        TOKEN_HASH: 'c'.repeat(64),
        INVITED_BY_MEMBERSHIP_ID: a.member,
        PUBLIC_ID: randomUUID(),
        TOKEN_KEY_VERSION: 'synthetic-v1',
      },
      expiration,
    );
    await insert('INVITATION_LOCATIONS', {
      TENANT_ID: a.tenant,
      INVITATION_ID: invitation,
      LOCATION_ID: a.location,
    });
    await reject(2291, ['FK_IL_LOCATION'], () =>
      insert('INVITATION_LOCATIONS', {
        TENANT_ID: a.tenant,
        INVITATION_ID: invitation,
        LOCATION_ID: b.location,
      }),
    );
    const otherLocation = id();
    await insert('LOCATIONS', {
      LOCATION_ID: otherLocation,
      TENANT_ID: a.tenant,
      BUSINESS_ID: a.business,
      PUBLIC_ID: randomUUID(),
      LOCATION_CODE: 'SECOND',
      LOCATION_NAME: 'Second synthetic location',
      ADDRESS_LINE_1: 'Synthetic test address',
      CITY: 'Synthetic city',
    });
    const hours = {
      OPERATING_HOUR_ID: id(),
      TENANT_ID: a.tenant,
      LOCATION_ID: a.location,
      RESOURCE_ID: a.resource,
      PUBLIC_ID: randomUUID(),
      DAY_OF_WEEK: 1,
      OPEN_MINUTE: 480,
      CLOSE_MINUTE: 1200,
    };
    await insert('OPERATING_HOURS', hours);
    await reject(2291, ['FK_OPERATING_HOURS_RESOURCE'], () =>
      insert('OPERATING_HOURS', {
        ...hours,
        OPERATING_HOUR_ID: id(),
        PUBLIC_ID: randomUUID(),
        LOCATION_ID: otherLocation,
      }),
    );
    await reject(2290, ['CK_OPERATING_HOURS_DAY'], () =>
      insert('OPERATING_HOURS', {
        ...hours,
        OPERATING_HOUR_ID: id(),
        PUBLIC_ID: randomUUID(),
        DAY_OF_WEEK: 8,
      }),
    );
    await reject(2290, ['CK_OPERATING_HOURS_TIMES'], () =>
      insert('OPERATING_HOURS', {
        ...hours,
        OPERATING_HOUR_ID: id(),
        PUBLIC_ID: randomUUID(),
        DAY_OF_WEEK: 2,
        OPEN_MINUTE: null,
      }),
    );
    const locationHours = {
      ...hours,
      OPERATING_HOUR_ID: id(),
      PUBLIC_ID: randomUUID(),
      RESOURCE_ID: null,
      DAY_OF_WEEK: 3,
    };
    await insert('OPERATING_HOURS', locationHours);
    await reject(1, ['UQ_OPERATING_HOURS_SEGMENT'], () =>
      insert('OPERATING_HOURS', {
        ...locationHours,
        OPERATING_HOUR_ID: id(),
        PUBLIC_ID: randomUUID(),
      }),
    );
    await reject(2290, ['CK_HOLIDAYS_TIMES'], () =>
      insert(
        'HOLIDAYS',
        {
          HOLIDAY_ID: id(),
          TENANT_ID: a.tenant,
          LOCATION_ID: a.location,
          HOLIDAY_NAME: 'Synthetic holiday',
          PUBLIC_ID: randomUUID(),
          IS_CLOSED: 'N',
          OPEN_MINUTE: null,
          CLOSE_MINUTE: null,
        },
        { HOLIDAY_DATE: "TO_DATE('2026-01-01','YYYY-MM-DD')" },
      ),
    );
    await reject(2290, ['CK_HOLIDAY_STATUS'], () =>
      insert(
        'HOLIDAYS',
        {
          HOLIDAY_ID: id(),
          TENANT_ID: a.tenant,
          LOCATION_ID: a.location,
          HOLIDAY_NAME: 'Synthetic invalid status',
          PUBLIC_ID: randomUUID(),
          HOLIDAY_STATUS: 'INVALID',
        },
        { HOLIDAY_DATE: "TO_DATE('2026-01-01','YYYY-MM-DD')" },
      ),
    );
    await reject(2290, ['CK_PRICING_RULES_RATE'], () =>
      insert(
        'PRICING_RULES',
        {
          PRICING_RULE_ID: id(),
          TENANT_ID: a.tenant,
          RESOURCE_ID: a.resource,
          RULE_CODE: 'NEGATIVE',
          HOURLY_RATE: '-1',
          PUBLIC_ID: randomUUID(),
        },
        { EFFECTIVE_FROM_UTC: 'LOCALTIMESTAMP' },
      ),
    );
    const tenantChildren = manifest.migrations
      .flatMap((entry) => entry.constraints)
      .filter((constraint) => constraint.type === 'R' && constraint.referencedTable === 'TENANTS')
      .map((constraint) => constraint.name);
    await reject(2292, tenantChildren, () =>
      session.execute(
        'DELETE FROM TENANTS WHERE TENANT_ID=:id',
        { id: a.tenant },
        { autoCommit: false },
      ),
    );
  } finally {
    try {
      await session.rollback();
    } catch {
      cleanupFailed = true;
      console.error('Synthetic fixture rollback failed; inspect disposable target.');
    }
  }
  if (cleanupFailed) throw new Error('Synthetic fixture rollback failed.');
  console.info(
    `PASS Oracle integrity: ${cases} exact error/constraint cases; two-tenant role/staff/facility/session boundaries, uniqueness, flags, schedules and protected deletion. Fixture DML is rolled back.`,
  );
}
