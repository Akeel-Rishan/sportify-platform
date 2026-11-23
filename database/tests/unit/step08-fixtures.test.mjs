import { describe, it, expect } from 'vitest';
import { loadManifest } from '@sportify/migrations';
import { fileURLToPath } from 'node:url';
import {
  slotStarts,
  fixtureSql,
  money,
  timestamp,
  assertTestOwner,
  requireOracle,
} from '../step08/fixtures.mjs';

describe('Step 08 fixture utilities (unit only, no Oracle evidence)', () => {
  it('builds half-open UTC slots across midnight and excludes the end', () => {
    expect(slotStarts('2035-01-01T23:45:00.000000Z', '2035-01-02T00:30:00.000000Z')).toEqual([
      '2035-01-01T23:45:00.000000Z',
      '2035-01-02T00:00:00.000000Z',
      '2035-01-02T00:15:00.000000Z',
    ]);
  });
  it('includes immutable before/after buffers as occupied half-open slots', () => {
    const slots = slotStarts('2035-01-02T07:45:00.000000Z', '2035-01-02T09:15:00.000000Z');
    expect(slots).toHaveLength(6);
    expect(slots.at(-1)).toBe('2035-01-02T09:00:00.000000Z');
    expect(slots).not.toContain('2035-01-02T09:15:00.000000Z');
  });
  it.each([
    ['2035-01-02T08:10:00.000000Z', '2035-01-02T09:00:00.000000Z'],
    ['2035-01-02T08:00:00.000001Z', '2035-01-02T09:00:00.000000Z'],
    ['2035-02-30T08:00:00.000000Z', '2035-03-03T09:00:00.000000Z'],
    ['2035-01-02T09:00:00.000000Z', '2035-01-02T09:00:00.000000Z'],
  ])('refuses invalid fixture interval %s', (start, end) =>
    expect(() => slotStarts(start, end)).toThrow(),
  );
  it('keeps exact monetary/timestamp strings as binds and allowlists identifiers', async () => {
    const manifest = await loadManifest(fileURLToPath(new URL('../../', import.meta.url)));
    const result = fixtureSql(manifest, 'PAYMENTS', {
      AMOUNT: money('9999999999.99'),
      RECEIVED_AT_UTC: timestamp('2035-01-02T08:00:00.000001Z'),
    });
    expect(result.binds).toEqual({ v0: '9999999999.99', v1: '2035-01-02T08:00:00.000001Z' });
    expect(result.sql).toContain('NLS_NUMERIC_CHARACTERS');
    expect(result.sql).not.toContain('9999999999.99');
    expect(() => fixtureSql(manifest, 'PAYMENTS', { UNKNOWN: 'value' })).toThrow();
    expect(() => fixtureSql(manifest, 'PAYMENTS; DROP TABLE USERS', {})).toThrow();
    expect(() => fixtureSql(manifest, 'PAYMENTS', { AMOUNT: money('1.001') })).toThrow();
  });
  it('refuses application/old test owners and unrelated transport errors', () => {
    for (const owner of ['ADMIN', 'SPORTIFY_SCHEMA_OWNER', 'SPORTIFY_TEST_OWNER'])
      expect(() => assertTestOwner(owner)).toThrow();
    expect(() =>
      requireOracle({ code: 'NJS-040' }, 1, ['PK_RESOURCE_SLOT_RESERVATIONS']),
    ).toThrow();
    expect(() =>
      requireOracle({ errorNum: 1, message: 'ORA-00001 (TEST.PK_RESOURCE_SLOT_RESERVATIONS)' }, 1, [
        'PK_RESOURCE_SLOT_RESERVATIONS',
      ]),
    ).not.toThrow();
  });
});
