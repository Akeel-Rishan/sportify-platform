// Real Oracle assertions, invoked exclusively by the isolated Step 09 suite.
import assert from 'node:assert/strict';
import {
  assertTestOwner,
  reject,
  money,
  timestamp,
  PAST,
  fingerprint,
  FIXTURE_MAX_ATTEMPTS,
} from './fixtures.mjs';

export async function verifyIntegrity(session, owner, f) {
  assertTestOwner(owner);
  let count = 0;
  const denied = async (code, names, work) => {
    await reject(session, code, names, work);
    count++;
  };
  let originalFailure = false,
    cleanupFailed = false;
  try {
    const entitlement = {
      PLAN_ID: f.plan,
      FEATURE_CODE: 'TEST_BOOLEAN',
      IS_ENABLED: 'Y',
      VALUE_KIND: 'BOOLEAN',
    };
    await f.insert('SUBSCRIPTION_ENTITLEMENTS', entitlement);
    await f.insert('SUBSCRIPTION_ENTITLEMENTS', {
      ...entitlement,
      FEATURE_CODE: 'TEST_LIMIT',
      VALUE_KIND: 'LIMIT',
      LIMIT_VALUE: 3,
      LIMIT_UNIT: 'COUNT',
    });
    await denied(2290, ['CK_SE_VALUE_KIND'], () =>
      f.insert('SUBSCRIPTION_ENTITLEMENTS', {
        ...entitlement,
        FEATURE_CODE: 'TEST_BAD',
        LIMIT_VALUE: 1,
      }),
    );
    await denied(2290, ['CK_SE_VALUE_KIND'], () =>
      f.insert('SUBSCRIPTION_ENTITLEMENTS', {
        ...entitlement,
        FEATURE_CODE: 'TEST_BAD',
        VALUE_KIND: 'LIMIT',
      }),
    );
    await denied(2290, ['CK_SE_LIMIT', 'CK_SE_VALUE_KIND'], () =>
      f.insert('SUBSCRIPTION_ENTITLEMENTS', {
        ...entitlement,
        FEATURE_CODE: 'TEST_BAD',
        VALUE_KIND: 'LIMIT',
        LIMIT_VALUE: -1,
        LIMIT_UNIT: 'COUNT',
      }),
    );
    await f.insert('SUBSCRIPTION_FEATURE_SNAPSHOTS', {
      TENANT_ID: f.a.tenant,
      SUBSCRIPTION_ID: f.subscriptions[0].SUBSCRIPTION_ID,
      FEATURE_CODE: 'TEST_LIMIT',
      IS_ENABLED: 'Y',
      VALUE_KIND: 'LIMIT',
      LIMIT_VALUE: 3,
      LIMIT_UNIT: 'COUNT',
    });
    await denied(2291, ['FK_SFS_SUBSCRIPTION'], () =>
      f.insert('SUBSCRIPTION_FEATURE_SNAPSHOTS', {
        TENANT_ID: f.a.tenant,
        SUBSCRIPTION_ID: f.subscriptions[1].SUBSCRIPTION_ID,
        FEATURE_CODE: 'TEST_LIMIT',
        IS_ENABLED: 'Y',
        VALUE_KIND: 'LIMIT',
        LIMIT_VALUE: 3,
        LIMIT_UNIT: 'COUNT',
      }),
    );
    await session.execute(
      'UPDATE SUBSCRIPTION_PLANS SET PLAN_NAME=:p_name,PRICE_AMOUNT=2000 WHERE PLAN_ID=:p_id',
      { p_name: 'Changed future plan metadata', p_id: f.plan },
    );
    const frozen = (
      await session.execute(
        'SELECT PLAN_NAME_SNAPSHOT,TO_CHAR(PRICE_AMOUNT_SNAPSHOT) AS PRICE FROM SUBSCRIPTIONS WHERE SUBSCRIPTION_ID=:p_id',
        { p_id: f.subscriptions[0].SUBSCRIPTION_ID },
        { outFormat: 4002 },
      )
    ).rows?.[0];
    assert.equal(frozen.PLAN_NAME_SNAPSHOT, 'Synthetic plan metadata');
    assert.equal(frozen.PRICE, '1000');
    await denied(1, ['UX_SUBSCRIPTIONS_ONE_CURRENT'], () =>
      f.insert('SUBSCRIPTIONS', f.subscriptionValues()),
    );
    await f.insert(
      'SUBSCRIPTIONS',
      f.subscriptionValues(f.a, { SUBSCRIPTION_STATUS: 'SCHEDULED' }),
    ); // Row uniqueness is not interval exclusion.
    await denied(2290, ['CK_SUBSCRIPTIONS_PERIOD'], () =>
      f.insert(
        'SUBSCRIPTIONS',
        f.subscriptionValues(f.a, {
          SUBSCRIPTION_STATUS: 'SCHEDULED',
          ENDS_AT_UTC: timestamp('1999-01-01T00:00:00.000000Z'),
        }),
      ),
    );
    await denied(2290, ['CK_SUBSCRIPTION_TRIAL_PAIR'], () =>
      f.insert(
        'SUBSCRIPTIONS',
        f.subscriptionValues(f.a, {
          SUBSCRIPTION_STATUS: 'SCHEDULED',
          TRIAL_STARTS_AT_UTC: timestamp(PAST),
        }),
      ),
    );
    for (const [state, constraint] of [
      ['TRIAL', 'CK_SUBSCRIPTION_TRIAL_STATE'],
      ['GRACE', 'CK_SUBSCRIPTION_GRACE'],
    ])
      await denied(2290, [constraint], async () => {
        await session.execute(
          "UPDATE SUBSCRIPTIONS SET SUBSCRIPTION_STATUS='EXPIRED' WHERE SUBSCRIPTION_ID=:p_id",
          { p_id: f.subscriptions[0].SUBSCRIPTION_ID },
        );
        await f.insert('SUBSCRIPTIONS', f.subscriptionValues(f.a, { SUBSCRIPTION_STATUS: state }));
      });
    await denied(2291, ['FK_SI_SUBSCRIPTION'], () =>
      f.insert('SUBSCRIPTION_INVOICES', f.invoiceValues(f.a, f.subscriptions[1])),
    );
    await denied(2291, ['FK_SP_INVOICE'], () =>
      f.insert('SUBSCRIPTION_PAYMENTS', f.paymentValues(f.a, f.invoices[1])),
    );
    await denied(2291, ['FK_SP_INVOICE'], () =>
      f.insert(
        'SUBSCRIPTION_PAYMENTS',
        f.paymentValues(f.a, f.invoices[0], { CURRENCY_CODE: 'USD' }),
      ),
    );
    await denied(2291, ['FK_SP_ADMIN_ACTOR'], () =>
      f.insert(
        'SUBSCRIPTION_PAYMENTS',
        f.paymentValues(f.a, f.invoices[0], { RECORDED_BY_USER_ID: f.b.user }),
      ),
    );
    await denied(2290, ['CK_SP_AMOUNT'], () =>
      f.insert(
        'SUBSCRIPTION_PAYMENTS',
        f.paymentValues(f.a, f.invoices[0], { AMOUNT: money('0.00') }),
      ),
    );
    await denied(2290, ['CK_SUBSCRIPTION_PAYMENTS_VOID'], () =>
      f.insert(
        'SUBSCRIPTION_PAYMENTS',
        f.paymentValues(f.a, f.invoices[0], { PAYMENT_STATUS: 'VOIDED' }),
      ),
    );
    const received = f.paymentValues();
    await f.insert('SUBSCRIPTION_PAYMENTS', received);
    await denied(2292, ['FK_SP_INVOICE'], () =>
      session.execute('DELETE FROM SUBSCRIPTION_INVOICES WHERE SUBSCRIPTION_INVOICE_ID=:p_id', {
        p_id: f.invoices[0].SUBSCRIPTION_INVOICE_ID,
      }),
    );

    const website = f.websiteValues();
    await f.insert('WEBSITE_SETTINGS', website);
    await denied(1, ['UQ_WEBSITE_SETTINGS_SUBDOMAIN'], () =>
      f.insert(
        'WEBSITE_SETTINGS',
        f.websiteValues(f.b, { SUBDOMAIN_SLUG: website.SUBDOMAIN_SLUG }),
      ),
    );
    await session.execute(
      "UPDATE WEBSITE_SETTINGS SET WEBSITE_STATUS='UNPUBLISHED' WHERE WEBSITE_ID=:p_id",
      { p_id: website.WEBSITE_ID },
    );
    await denied(1, ['UQ_WEBSITE_SETTINGS_SUBDOMAIN'], () =>
      f.insert(
        'WEBSITE_SETTINGS',
        f.websiteValues(f.b, { SUBDOMAIN_SLUG: website.SUBDOMAIN_SLUG }),
      ),
    );
    await denied(1, ['UQ_WEBSITE_SETTINGS_BUSINESS'], () =>
      f.insert('WEBSITE_SETTINGS', f.websiteValues()),
    );
    await denied(2290, ['CK_WEBSITE_SETTINGS_SLUG', 'CK_WEBSITE_HOST_CANONICAL'], () =>
      f.insert('WEBSITE_SETTINGS', f.websiteValues(f.b, { SUBDOMAIN_SLUG: 'UPPER-' + f.nonce })),
    );
    await denied(2290, ['CK_WEBSITE_HOST_CANONICAL'], () =>
      f.insert('WEBSITE_SETTINGS', f.websiteValues(f.b, { SUBDOMAIN_SLUG: 'api' })),
    );
    await denied(2290, ['CK_WEBSITE_DNS_LABEL'], () =>
      f.insert('WEBSITE_SETTINGS', f.websiteValues(f.b, { SUBDOMAIN_SLUG: 'a'.repeat(64) })),
    );
    await denied(2290, ['CK_WEBSITE_PUBLISHED'], () =>
      f.insert('WEBSITE_SETTINGS', f.websiteValues(f.b, { WEBSITE_STATUS: 'PUBLISHED' })),
    );
    await denied(2291, ['FK_WEBSITE_SETTINGS_BUSINESS'], () =>
      f.insert('WEBSITE_SETTINGS', f.websiteValues(f.b, { BUSINESS_ID: f.a.business })),
    );
    await f.insert('WEBSITE_MEDIA', f.mediaValues());
    await denied(2291, ['FK_WEBSITE_MEDIA_BUSINESS'], () =>
      f.insert('WEBSITE_MEDIA', f.mediaValues(f.a, { BUSINESS_ID: f.b.business })),
    );
    await denied(2291, ['FK_WEBSITE_MEDIA_LOCATION'], () =>
      f.insert('WEBSITE_MEDIA', f.mediaValues(f.a, { LOCATION_ID: f.b.location })),
    );
    await denied(2291, ['FK_WEBSITE_MEDIA_RESOURCE'], () =>
      f.insert(
        'WEBSITE_MEDIA',
        f.mediaValues(f.a, { LOCATION_ID: f.a.location, RESOURCE_ID: f.b.resources[0].id }),
      ),
    );
    await denied(2290, ['CK_WEBSITE_MEDIA_OWNER'], () =>
      f.insert('WEBSITE_MEDIA', f.mediaValues(f.a, { RESOURCE_ID: f.a.resources[0].id })),
    );
    await denied(2290, ['CK_WEBSITE_OBJECT_KEY'], () =>
      f.insert(
        'WEBSITE_MEDIA',
        f.mediaValues(f.a, { OBJECT_KEY: 'https://example.invalid/file?signature=synthetic' }),
      ),
    );

    await f.insert('AUDIT_LOGS', f.auditValues());
    await f.insert('AUDIT_LOGS', f.auditValues(null));
    await denied(2291, ['FK_AUDIT_LOGS_MEMBERSHIP_ACTOR'], () =>
      f.insert(
        'AUDIT_LOGS',
        f.auditValues(f.a, { ACTOR_MEMBERSHIP_ID: f.b.member, ACTOR_USER_ID: f.b.user }),
      ),
    );
    await denied(2290, ['CK_AUDIT_LOGS_SCOPE', 'CK_AUDIT_ACTOR', 'CK_AUDIT_LOGS_MEMBERSHIP'], () =>
      f.insert('AUDIT_LOGS', f.auditValues(f.a, { SCOPE_KIND: 'PLATFORM' })),
    );
    await denied(2290, ['CK_AUDIT_ACTOR'], () =>
      f.insert('AUDIT_LOGS', f.auditValues(f.a, { ACTOR_TYPE: 'WORKER' })),
    );
    for (const [table, values, constraint] of [
      [
        'AUDIT_LOGS',
        () => f.auditValues(f.a, { AFTER_DATA: '{invalid}' }),
        'CK_AUDIT_AFTER_DATA_JSON',
      ],
      [
        'OUTBOX_EVENTS',
        () => f.eventValues(f.a, { PAYLOAD: '{"same":1,"same":2}' }),
        'CK_OUTBOX_PAYLOAD_JSON',
      ],
      ['JOB_QUEUE', () => f.jobValues(f.a, { PAYLOAD: '{invalid}' }), 'CK_JOB_PAYLOAD_JSON'],
      [
        'IDEMPOTENCY_KEYS',
        () =>
          f.idemValues(f.a, {
            EXECUTION_STATUS: 'COMPLETED',
            LEASE_TOKEN: null,
            LEASE_EXPIRES_AT_UTC: null,
            RESPONSE_STATUS: 200,
            RESPONSE_BODY: '{invalid}',
          }),
        'CK_IDEM_RESPONSE_JSON',
      ],
    ])
      await denied(2290, [constraint], () => f.insert(table, values()));
    const event = f.eventValues();
    await f.insert('OUTBOX_EVENTS', event);
    const job = f.jobValues(f.a, {
      SOURCE_OUTBOX_EVENT_ID: event.OUTBOX_EVENT_ID,
      CONSUMER_CODE: 'consumer-v1',
    });
    await f.insert('JOB_QUEUE', job);
    await f.insert(
      'JOB_QUEUE',
      f.jobValues(f.a, {
        SOURCE_OUTBOX_EVENT_ID: event.OUTBOX_EVENT_ID,
        CONSUMER_CODE: 'other-consumer-v1',
      }),
    );
    await denied(1, ['UQ_JOB_EVENT_CONSUMER'], () =>
      f.insert(
        'JOB_QUEUE',
        f.jobValues(f.a, {
          SOURCE_OUTBOX_EVENT_ID: event.OUTBOX_EVENT_ID,
          CONSUMER_CODE: 'consumer-v1',
        }),
      ),
    );
    await denied(2291, ['FK_JOB_EVENT_TENANT'], () =>
      f.insert(
        'JOB_QUEUE',
        f.jobValues(f.b, {
          SOURCE_OUTBOX_EVENT_ID: event.OUTBOX_EVENT_ID,
          CONSUMER_CODE: 'cross-tenant',
        }),
      ),
    );
    await denied(2291, ['FK_JOB_EVENT_SCOPE'], () =>
      f.insert(
        'JOB_QUEUE',
        f.jobValues(null, {
          SOURCE_OUTBOX_EVENT_ID: event.OUTBOX_EVENT_ID,
          CONSUMER_CODE: 'wrong-platform',
        }),
      ),
    );
    await denied(2290, ['CK_JOB_LEASE'], () =>
      f.insert('JOB_QUEUE', f.jobValues(f.a, { JOB_STATUS: 'RUNNING' })),
    );
    await denied(2290, ['CK_JOB_QUEUE_ATTEMPTS'], () =>
      f.insert('JOB_QUEUE', f.jobValues(f.a, { ATTEMPT_COUNT: FIXTURE_MAX_ATTEMPTS + 1 })),
    );
    for (const [table, values] of [
      ['OUTBOX_EVENTS', f.eventValues()],
      ['JOB_QUEUE', f.jobValues()],
    ]) {
      delete values.MAX_ATTEMPTS;
      await denied(1400, [], () => f.insert(table, values));
    }
    await denied(2290, ['CK_JOB_TERMINAL'], () =>
      f.insert('JOB_QUEUE', f.jobValues(f.a, { JOB_STATUS: 'COMPLETED' })),
    );
    for (const tenant of [f.a, null]) {
      const deduped = f.jobValues(tenant);
      await f.insert('JOB_QUEUE', deduped);
      await denied(1, ['UX_JOB_QUEUE_DEDUPE'], () =>
        f.insert('JOB_QUEUE', f.jobValues(tenant, { DEDUPE_KEY: deduped.DEDUPE_KEY })),
      );
      await f.insert('JOB_QUEUE', f.jobValues(tenant, { DEDUPE_KEY: null }));
      await f.insert('JOB_QUEUE', f.jobValues(tenant, { DEDUPE_KEY: null }));
      const idem = f.idemValues(tenant);
      await f.insert('IDEMPOTENCY_KEYS', idem);
      // Identical key/owner/operation remains independent across actual scopes.
      await f.insert(
        'IDEMPOTENCY_KEYS',
        f.idemValues(f.b, { IDEMPOTENCY_KEY: idem.IDEMPOTENCY_KEY }),
      );
      await f.insert(
        'IDEMPOTENCY_KEYS',
        f.idemValues(tenant ? null : f.a, { IDEMPOTENCY_KEY: idem.IDEMPOTENCY_KEY }),
      );
      await denied(1, ['UQ_IDEMPOTENCY_OWNER_KEY'], () =>
        f.insert(
          'IDEMPOTENCY_KEYS',
          f.idemValues(tenant, { IDEMPOTENCY_KEY: idem.IDEMPOTENCY_KEY }),
        ),
      );
      await f.insert(
        'IDEMPOTENCY_KEYS',
        f.idemValues(tenant, {
          IDEMPOTENCY_KEY: idem.IDEMPOTENCY_KEY,
          OWNER_SCOPE: fingerprint({ testRun: f.nonce, owner: 'different-user' }),
        }),
      );
      await f.insert(
        'IDEMPOTENCY_KEYS',
        f.idemValues(tenant, {
          IDEMPOTENCY_KEY: idem.IDEMPOTENCY_KEY,
          OPERATION_SCOPE: idem.OPERATION_SCOPE + '.other',
        }),
      );
    }
    await denied(2290, ['CK_IDEM_SCOPE'], () =>
      f.insert('IDEMPOTENCY_KEYS', f.idemValues(null, { SCOPE_KIND: 'TENANT' })),
    );
    await denied(2290, ['CK_IDEM_LEASE'], () =>
      f.insert('IDEMPOTENCY_KEYS', f.idemValues(f.a, { LEASE_TOKEN: null })),
    );
    await denied(2290, ['CK_IDEM_RESULT_STATE'], () =>
      f.insert(
        'IDEMPOTENCY_KEYS',
        f.idemValues(f.a, {
          EXECUTION_STATUS: 'COMPLETED',
          LEASE_TOKEN: null,
          LEASE_EXPIRES_AT_UTC: null,
        }),
      ),
    );
    await denied(2290, ['CK_IDEMPOTENCY_KEYS_REQUEST_HASH'], () =>
      f.insert('IDEMPOTENCY_KEYS', f.idemValues(f.a, { REQUEST_HASH: 'not-a-fingerprint' })),
    );
    await denied(2290, ['CK_IDEM_KEY_LENGTH'], () =>
      f.insert('IDEMPOTENCY_KEYS', f.idemValues(f.a, { IDEMPOTENCY_KEY: 'short' })),
    );
  } catch (error) {
    originalFailure = true;
    console.error(
      JSON.stringify({
        event: 'step09.integrity.failed',
        completedRejections: count,
        oracle: Number.isInteger(error?.errorNum) ? error.errorNum : null,
      }),
    );
    throw error;
  } finally {
    try {
      await session.rollback();
    } catch {
      cleanupFailed = true;
      console.error('Step 09 fixture rollback failed; inspect the isolated target.');
    }
  }
  if (cleanupFailed && !originalFailure) throw new Error('Isolated fixture rollback failed.');
  console.info(
    `PASS real Oracle Step 09 integrity: ${count} specific rejections plus valid independent scopes, history snapshots, fan-out and excluded dedupe keys. Fixture DML rolled back; no production workflows implemented.`,
  );
}
