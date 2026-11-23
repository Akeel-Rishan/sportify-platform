import { describe, it, expect, vi } from 'vitest';
import { loadManifest } from '@sportify/migrations';
import { fileURLToPath } from 'node:url';
import {
  canonicalFixtureJson,
  fingerprint,
  fixtureReplay,
  createFixtures,
  assertTestOwner,
  TEST_OWNER,
  fixtureSql,
  FIXTURE_MAX_ATTEMPTS,
} from '../step09/fixtures.mjs';
import { createFixtures as createVenueRoots } from '../step08/fixtures.mjs';

const manifest = () => loadManifest(fileURLToPath(new URL('../../', import.meta.url)));
const fakeSession = () => ({
  execute: vi.fn(async (sql) =>
    sql.startsWith('SELECT TO_CHAR(SPORT_ID)') ? { rows: [{ ID: '1' }] } : { rowsAffected: 1 },
  ),
  commit: vi.fn(async () => {}),
});
describe('Step 09 test-harness utilities (unit only; no Oracle evidence)', () => {
  it('canonicalizes validated fixture keys recursively while preserving array order and exact amount strings', () => {
    expect(canonicalFixtureJson({ z: ['1.00', { b: 2, a: true }], a: null })).toBe(
      '{"a":null,"z":["1.00",{"a":true,"b":2}]}',
    );
    expect(fingerprint({ a: 1, b: { c: '1000.00' } })).toBe(
      fingerprint({ b: { c: '1000.00' }, a: 1 }),
    );
    expect(fingerprint(['a', 'b'])).not.toBe(fingerprint(['b', 'a']));
    expect(fingerprint({ amount: '1.00' })).not.toBe(fingerprint({ amount: 1 }));
    for (const value of [undefined, NaN, Infinity, new Date(), { a: undefined }])
      expect(() => fingerprint(value)).toThrow();
  });
  it('requires the same authorized owner/scope before replay or mismatch classification', () => {
    const record = {
      scope: 'tenant:fixture:operation',
      owner: 'fixture-owner',
      fingerprint: fingerprint({ x: 1 }),
      state: 'COMPLETED',
      payload: { safe: 'reference' },
    };
    const claim = { scope: record.scope, owner: record.owner, fingerprint: record.fingerprint };
    expect(fixtureReplay(record, claim)).toEqual({ kind: 'replay', payload: record.payload });
    expect(fixtureReplay(record, { ...claim, fingerprint: fingerprint({ x: 2 }) })).toEqual({
      kind: 'conflict',
    });
    expect(fixtureReplay({ ...record, state: 'PROCESSING' }, claim)).toEqual({
      kind: 'in_progress',
    });
    expect(() => fixtureReplay({ ...record, state: 'FAILED' }, claim)).toThrow();
    expect(() => fixtureReplay(record, { ...claim, owner: 'other' })).toThrow();
    expect(() => fixtureReplay(record, { ...claim, scope: 'other' })).toThrow();
  });
  it('keeps Step 09 setup atomic and all fixture builders within manifest column boundaries', async () => {
    const source = await manifest(),
      session = fakeSession();
    const f = await createFixtures(session, TEST_OWNER, source);
    expect(session.commit).toHaveBeenCalledTimes(1);
    // Both future insertion paths provide explicit test-only retry budgets.
    expect(f.eventValues().MAX_ATTEMPTS).toBe(FIXTURE_MAX_ATTEMPTS);
    expect(f.jobValues().MAX_ATTEMPTS).toBe(FIXTURE_MAX_ATTEMPTS);
    for (const method of [
      'subscriptionValues',
      'invoiceValues',
      'paymentValues',
      'websiteValues',
      'mediaValues',
      'auditValues',
      'eventValues',
      'jobValues',
      'idemValues',
    ]) {
      const table = {
        subscriptionValues: 'SUBSCRIPTIONS',
        invoiceValues: 'SUBSCRIPTION_INVOICES',
        paymentValues: 'SUBSCRIPTION_PAYMENTS',
        websiteValues: 'WEBSITE_SETTINGS',
        mediaValues: 'WEBSITE_MEDIA',
        auditValues: 'AUDIT_LOGS',
        eventValues: 'OUTBOX_EVENTS',
        jobValues: 'JOB_QUEUE',
        idemValues: 'IDEMPOTENCY_KEYS',
      }[method];
      expect(() => fixtureSql(source, table, f[method]())).not.toThrow();
    }
    const values = f.idemValues(null);
    expect(values.SCOPE_KIND).toBe('PLATFORM');
    expect(values.TENANT_ID).toBeNull();
    expect(f.globalRows).toContainEqual({ table: 'IDEMPOTENCY_KEYS', id: values.IDEMPOTENCY_ID });
    const failed = fakeSession();
    failed.execute.mockRejectedValueOnce(new Error('synthetic initialization failure'));
    await expect(createFixtures(failed, TEST_OWNER, source)).rejects.toThrow();
    expect(failed.commit).not.toHaveBeenCalled();
  });
  it('preserves the Step 08 default commit and refuses widening its default owner boundary', async () => {
    const source = await manifest(),
      normal = fakeSession(),
      deferred = fakeSession();
    await createVenueRoots(normal, 'SPORTIFY_STEP08_TEST_OWNER', source);
    expect(normal.commit).toHaveBeenCalledTimes(1);
    await createVenueRoots(deferred, TEST_OWNER, source, {
      expectedOwner: TEST_OWNER,
      commitSetup: false,
    });
    expect(deferred.commit).not.toHaveBeenCalled();
    const denied = fakeSession();
    await expect(createVenueRoots(denied, TEST_OWNER, source)).rejects.toThrow();
    expect(denied.execute).not.toHaveBeenCalled();
    for (const owner of [
      'ADMIN',
      'SPORTIFY_SCHEMA_OWNER',
      'SPORTIFY_TEST_OWNER',
      'SPORTIFY_STEP08_TEST_OWNER',
    ])
      expect(() => assertTestOwner(owner)).toThrow();
  });
});
