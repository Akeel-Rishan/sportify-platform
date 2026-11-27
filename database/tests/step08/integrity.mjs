import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { START, END, timestamp, money, slotStarts, reject, assertTestOwner } from './fixtures.mjs';

export async function verifyIntegrity(session, owner, manifest, f) {
  assertTestOwner(owner, f.expectedOwner);
  let cases = 0,
    failed = false,
    cleanupFailed = false;
  const denied = async (number, names, work) => {
    await reject(session, number, names, work);
    cases++;
  };
  try {
    const booking = await f.booking(),
      other = await f.booking(f.b),
      alternative = await f.booking(f.a, f.a.resources[1]);
    const hold = await f.hold(),
      otherHold = await f.hold(f.b),
      alternativeHold = await f.hold(f.a, f.a.resources[1]);
    // No customer is referenced by a hold. Manual bookings with null source
    // hold remain repeatable because both conditional unique-index keys are null.
    await f.booking();
    await f.insert('CUSTOMERS', {
      CUSTOMER_ID: f.id(),
      TENANT_ID: f.a.tenant,
      PUBLIC_ID: randomUUID(),
      FULL_NAME: 'Duplicate contact is allowed',
      MOBILE_E164: '+99900000001',
      EMAIL: 'synthetic@example.invalid',
      EMAIL_NORMALIZED: 'synthetic@example.invalid',
    });
    await denied(2291, ['FK_BOOKINGS_CUSTOMER'], () =>
      f.insert('BOOKINGS', f.bookingValues(f.a, { CUSTOMER_ID: f.b.customer })),
    );
    await denied(2291, ['FK_BOOKINGS_HOLD'], () =>
      f.insert('BOOKINGS', f.bookingValues(f.a, { SOURCE_HOLD_ID: otherHold.id })),
    );
    const conversion = f.bookingValues(f.a, { SOURCE_HOLD_ID: hold.id });
    await f.insert('BOOKINGS', conversion);
    await denied(1, ['UX_BOOKINGS_SOURCE_HOLD'], () =>
      f.insert('BOOKINGS', f.bookingValues(f.a, { SOURCE_HOLD_ID: hold.id })),
    );
    await denied(1, ['UQ_BOOKINGS_REFERENCE'], () =>
      f.insert(
        'BOOKINGS',
        f.bookingValues(f.a, { BOOKING_REFERENCE: booking.header.BOOKING_REFERENCE }),
      ),
    );
    await denied(2290, ['CK_BOOKINGS_STATUS'], () =>
      f.insert('BOOKINGS', f.bookingValues(f.a, { BOOKING_STATUS: 'INVALID' })),
    );
    await denied(2290, ['CK_BOOKINGS_TOTAL'], () =>
      f.insert('BOOKINGS', f.bookingValues(f.a, { TOTAL_AMOUNT: money('-1.00') })),
    );
    // D-21 adds an active booking state; booking/payment state stay independent.
    await f.booking(f.a, f.a.resources[0], { BOOKING_STATUS: 'PENDING_PAYMENT' });
    await denied(2290, ['CK_BOOKINGS_ZERO_PAYMENT'], () =>
      f.insert('BOOKINGS', f.bookingValues(f.a, { TOTAL_AMOUNT: money('0.00') })),
    );
    const free = await f.booking(
      f.a,
      f.a.resources[0],
      { TOTAL_AMOUNT: money('0.00'), PAYMENT_STATUS: 'PAID' },
      { HOURLY_RATE_SNAPSHOT: money('0.00'), LINE_TOTAL: money('0.00') },
    );
    assert.equal(
      (
        await session.execute(
          'SELECT COUNT(*) AS TOTAL FROM PAYMENTS WHERE TENANT_ID=:tenant AND BOOKING_ID=:booking',
          { tenant: f.a.tenant, booking: free.id },
          { outFormat: 4002 },
        )
      ).rows?.[0]?.TOTAL,
      0,
    );
    // Both tenant/header FKs reject this cross-tenant ID. Oracle does not
    // promise which violated FK it reports first; accept only these two.
    await denied(2291, ['FK_BOOKING_ITEMS_BOOKING', 'FK_BI_CURRENCY'], () =>
      f.insert('BOOKING_ITEMS', {
        ...f.itemValues(),
        BOOKING_ITEM_ID: f.id(),
        BOOKING_ID: other.id,
      }),
    );
    await denied(2291, ['FK_BOOKING_HOLD_ITEMS_HOLD'], () =>
      f.insert('BOOKING_HOLD_ITEMS', {
        ...f.itemValues(),
        HOLD_ITEM_ID: f.id(),
        HOLD_ID: otherHold.id,
      }),
    );
    await denied(2290, ['CK_BOOKING_ITEMS_DURATION'], () =>
      f.insert('BOOKING_ITEMS', {
        ...f.itemValues(),
        BOOKING_ITEM_ID: f.id(),
        BOOKING_ID: booking.id,
        DURATION_MINUTES: 45,
      }),
    );
    await denied(2290, ['CK_BOOKING_ITEMS_OCCUPANCY'], () =>
      f.insert('BOOKING_ITEMS', {
        ...f.itemValues(),
        BOOKING_ITEM_ID: f.id(),
        BOOKING_ID: booking.id,
        BUFFER_BEFORE_MINUTES: 7,
      }),
    );
    await denied(2290, ['CK_BOOKING_HOLDS_STATUS'], () =>
      f.insert('BOOKING_HOLDS', f.holdValues(f.a, { HOLD_STATUS: 'INVALID' })),
    );
    await denied(2290, ['CK_BOOKING_HOLDS_EXPIRY'], () =>
      f.insert(
        'BOOKING_HOLDS',
        f.holdValues(f.a, { EXPIRES_AT_UTC: timestamp('2000-01-01T00:00:00.000000Z') }),
      ),
    );
    await denied(2291, ['FK_BI_CURRENCY'], () =>
      f.insert('BOOKING_ITEMS', {
        ...f.itemValues(),
        BOOKING_ITEM_ID: f.id(),
        BOOKING_ID: booking.id,
        CURRENCY_CODE: 'USD',
      }),
    );
    const slot = (extra = {}) => ({
      TENANT_ID: f.a.tenant,
      RESOURCE_ID: booking.resource,
      SLOT_START_UTC: timestamp(START),
      BOOKING_ITEM_ID: booking.item,
      HOLD_ITEM_ID: null,
      ...extra,
    });
    await denied(2290, ['CK_SLOT_RESERVATIONS_OWNER'], () =>
      f.insert('RESOURCE_SLOT_RESERVATIONS', slot({ BOOKING_ITEM_ID: null })),
    );
    await denied(2290, ['CK_SLOT_RESERVATIONS_OWNER'], () =>
      f.insert('RESOURCE_SLOT_RESERVATIONS', slot({ HOLD_ITEM_ID: hold.item })),
    );
    await denied(2291, ['FK_SLOTS_BOOKING_ITEM'], () =>
      f.insert('RESOURCE_SLOT_RESERVATIONS', slot({ BOOKING_ITEM_ID: alternative.item })),
    );
    await denied(2291, ['FK_SLOT_RESERVATIONS_HOLD_ITEM'], () =>
      f.insert(
        'RESOURCE_SLOT_RESERVATIONS',
        slot({ BOOKING_ITEM_ID: null, HOLD_ITEM_ID: alternativeHold.item }),
      ),
    );
    await denied(2291, ['FK_SLOTS_BOOKING_ITEM'], () =>
      f.insert('RESOURCE_SLOT_RESERVATIONS', slot({ BOOKING_ITEM_ID: other.item })),
    );
    for (const invalid of [
      '2035-01-02T08:10:00.000000Z',
      '2035-01-02T08:00:01.000000Z',
      '2035-01-02T08:00:00.000001Z',
    ])
      await denied(2290, ['CK_SLOT_RESERVATIONS_GRID'], () =>
        f.insert('RESOURCE_SLOT_RESERVATIONS', slot({ SLOT_START_UTC: timestamp(invalid) })),
      );
    await f.insert('RESOURCE_SLOT_RESERVATIONS', slot());
    await denied(1, ['PK_RESOURCE_SLOT_RESERVATIONS'], () =>
      f.insert(
        'RESOURCE_SLOT_RESERVATIONS',
        slot({ BOOKING_ITEM_ID: null, HOLD_ITEM_ID: hold.item }),
      ),
    );
    await f.slots(session, alternative, [START]);
    await f.slots(session, other, [START]);
    await session.execute('DELETE FROM RESOURCE_SLOT_RESERVATIONS WHERE TENANT_ID=:tenant', {
      tenant: f.a.tenant,
    });
    const times = slotStarts(START, END);
    await f.slots(session, hold, times, 'hold');
    assert.equal(times.length, 4);
    assert.ok(!times.includes(END));
    const count = (
      await session.execute(
        'SELECT COUNT(*) AS TOTAL FROM RESOURCE_SLOT_RESERVATIONS WHERE TENANT_ID=:tenant AND RESOURCE_ID=:resourceId',
        { tenant: f.a.tenant, resourceId: hold.resource },
        { outFormat: 4002 },
      )
    ).rows?.[0]?.TOTAL;
    assert.equal(count, 4);
    // A past expired fixture still owns physical keys. This is a constraint
    // backstop check, not an implementation of the future expiry transaction.
    await session.execute(
      'UPDATE BOOKING_HOLDS SET HOLD_STATUS=\'EXPIRED\',CREATED_AT_UTC=TO_TIMESTAMP(:created,\'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"\'),EXPIRES_AT_UTC=TO_TIMESTAMP(:expiry,\'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"\') WHERE TENANT_ID=:tenant AND HOLD_ID=:hold',
      {
        created: '2000-01-01T00:00:00.000000Z',
        expiry: '2001-01-01T00:00:00.000000Z',
        tenant: f.a.tenant,
        hold: hold.id,
      },
    );
    await denied(1, ['PK_RESOURCE_SLOT_RESERVATIONS'], () =>
      f.insert('RESOURCE_SLOT_RESERVATIONS', slot()),
    );
    const payment = (extra = {}) => ({
      PAYMENT_ID: f.id(),
      TENANT_ID: f.a.tenant,
      BOOKING_ID: booking.id,
      PAYMENT_METHOD: 'CASH',
      AMOUNT: money('1000.00'),
      CURRENCY_CODE: 'LKR',
      RECEIVED_AT_UTC: timestamp(START),
      RECORDED_BY_MEMBERSHIP_ID: f.a.member,
      PUBLIC_ID: randomUUID(),
      ...extra,
    });
    await denied(2291, ['FK_PAYMENTS_BOOKING'], () =>
      f.insert('PAYMENTS', payment({ BOOKING_ID: other.id })),
    );
    await denied(2291, ['FK_PAYMENTS_BOOKING'], () =>
      f.insert('PAYMENTS', payment({ CURRENCY_CODE: 'USD' })),
    );
    await denied(2290, ['CK_PAYMENTS_AMOUNT'], () =>
      f.insert('PAYMENTS', payment({ AMOUNT: money('0.00') })),
    );
    await denied(2290, ['CK_PAYMENTS_METHOD'], () =>
      f.insert('PAYMENTS', payment({ PAYMENT_METHOD: 'OTHER' })),
    );
    await denied(2290, ['CK_PAYMENTS_VOID'], () =>
      f.insert('PAYMENTS', payment({ PAYMENT_STATUS: 'VOIDED' })),
    );
    const paid = payment({ PAYMENT_REFERENCE: 'S8-SYNTHETIC-EXTERNAL-REF' });
    await f.insert('PAYMENTS', paid);
    await denied(1, ['UX_PAYMENTS_POSTED_BOOKING'], () => f.insert('PAYMENTS', payment()));
    // Multiple voided corrections do not consume the effective posted key.
    for (let attempt = 0; attempt < 2; attempt++)
      await f.insert(
        'PAYMENTS',
        payment({
          PAYMENT_STATUS: 'VOIDED',
          VOIDED_AT_UTC: timestamp(END),
          VOID_REASON: 'Synthetic correction',
          VOIDED_BY_MEMBERSHIP_ID: f.a.member,
        }),
      );
    await f.insert(
      'PAYMENTS',
      payment({ BOOKING_ID: alternative.id, PAYMENT_REFERENCE: 'S8-SYNTHETIC-EXTERNAL-REF' }),
    );
    const unpaid = await f.booking();
    await denied(1, ['UQ_PAYMENTS_PUBLIC_ID'], () =>
      f.insert('PAYMENTS', payment({ BOOKING_ID: unpaid.id, PUBLIC_ID: paid.PUBLIC_ID })),
    );
    const refund = (extra = {}) => ({
      REFUND_ID: f.id(),
      TENANT_ID: f.a.tenant,
      PAYMENT_ID: paid.PAYMENT_ID,
      AMOUNT: money('1000.00'),
      CURRENCY_CODE: 'LKR',
      REFUND_REASON: 'Synthetic manual refund',
      PROCESSED_AT_UTC: timestamp(END),
      RECORDED_BY_MEMBERSHIP_ID: f.a.member,
      PUBLIC_ID: randomUUID(),
      ...extra,
    });
    await denied(2291, ['FK_REFUNDS_PAYMENT', 'FK_REFUNDS_RECORDER'], () =>
      f.insert('REFUNDS', refund({ TENANT_ID: f.b.tenant, RECORDED_BY_MEMBERSHIP_ID: f.b.member })),
    );
    await denied(2291, ['FK_REFUNDS_PAYMENT'], () =>
      f.insert('REFUNDS', refund({ CURRENCY_CODE: 'USD' })),
    );
    await denied(2290, ['CK_REFUNDS_AMOUNT'], () =>
      f.insert('REFUNDS', refund({ AMOUNT: money('-1.00') })),
    );
    await denied(2290, ['CK_REFUND_PROCESSED'], () =>
      f.insert('REFUNDS', refund({ PROCESSED_AT_UTC: null })),
    );
    await f.insert('REFUNDS', refund());
    await denied(1, ['UX_REFUNDS_PROCESSED_PAYMENT'], () => f.insert('REFUNDS', refund()));
    // Source compatibility states remain storable history, not enabled workflows.
    for (const state of ['REQUESTED', 'REJECTED'])
      await f.insert('REFUNDS', refund({ REFUND_STATUS: state, PROCESSED_AT_UTC: null }));
    await denied(2292, ['FK_REFUNDS_PAYMENT'], () =>
      session.execute('DELETE FROM PAYMENTS WHERE PAYMENT_ID=:id', { id: paid.PAYMENT_ID }),
    );
    const dependents = manifest.migrations
      .flatMap((entry) => entry.constraints)
      .filter((key) => key.type === 'R' && key.referencedTable === 'BOOKINGS')
      .map((key) => key.name);
    await denied(2292, dependents, () =>
      session.execute('DELETE FROM BOOKINGS WHERE BOOKING_ID=:id', { id: booking.id }),
    );
    const cancellation = {
      CANCELLATION_ID: f.id(),
      TENANT_ID: f.a.tenant,
      BOOKING_ID: booking.id,
      CANCELLED_BY_MEMBERSHIP_ID: f.a.member,
      CANCELLATION_REASON: 'Synthetic test cancellation',
    };
    await f.insert('BOOKING_CANCELLATIONS', cancellation);
    await denied(1, ['UQ_BC_BOOKING'], () =>
      f.insert('BOOKING_CANCELLATIONS', { ...cancellation, CANCELLATION_ID: f.id() }),
    );
    await denied(2291, ['FK_BC_BOOKING'], () =>
      f.insert('BOOKING_CANCELLATIONS', {
        ...cancellation,
        CANCELLATION_ID: f.id(),
        BOOKING_ID: other.id,
      }),
    );
    assert.equal(
      (
        await session.execute(
          'SELECT COUNT(*) AS TOTAL FROM PAYMENTS WHERE PAYMENT_ID=:id',
          { id: paid.PAYMENT_ID },
          { outFormat: 4002 },
        )
      ).rows?.[0]?.TOTAL,
      1,
    );
    // REFUNDS has no independently editable BOOKING_ID: booking identity is
    // normalized through its tenant/payment/currency FK, never a redundant link.
    assert.ok(
      !manifest.migrations
        .flatMap((entry) => entry.tables)
        .find((table) => table.name === 'REFUNDS')
        .columns.some((column) => column.name === 'BOOKING_ID'),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'step08.integrity.failed',
        completedRejections: cases,
        oracle: Number.isInteger(error?.errorNum) ? error.errorNum : null,
        assertion: error?.code === 'ERR_ASSERTION',
      }),
    );
    failed = true;
    throw error;
  } finally {
    try {
      await session.rollback();
    } catch {
      cleanupFailed = true;
      console.error('Step 08 integrity rollback failed; inspect disposable target.');
    }
  }
  if (cleanupFailed && !failed) throw new Error('Integrity rollback failed.');
  console.info(
    `PASS Step 08 Oracle integrity: ${cases} exact rejection cases plus valid hold/booking ownership, independent resources/tenants, four half-open slots and preserved finance history. Fixture DML rolled back.`,
  );
}
