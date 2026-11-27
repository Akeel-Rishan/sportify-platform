import { describe, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadManifest } from '@sportify/migrations';
import { fixtureSql } from '../step08/fixtures.mjs';
import { createFixtures } from '../step09/fixtures.mjs';
import { collectTenantFixtures, requiredTenantColumn } from '../step10/tenant-relationships.mjs';
import {
  CLEAN_OWNER,
  UPGRADE_OWNER,
  assertDisposable,
  safeFailure,
  step10Configuration,
} from '../step10/config.mjs';

describe('Step 10 operator harness boundaries (unit only)', () => {
  it('accepts only its two disposable owners and fails missing configuration', async () => {
    expect(() => assertDisposable(CLEAN_OWNER)).not.toThrow();
    expect(() => assertDisposable(UPGRADE_OWNER)).not.toThrow();
    expect(() => assertDisposable('SPORTIFY_SCHEMA_OWNER')).toThrow();
    expect(() => assertDisposable('SPORTIFY_STEP09_TEST_OWNER')).toThrow();
    expect(() => step10Configuration({})).toThrow();
    const execute = vi.fn();
    await expect(createFixtures({ execute }, CLEAN_OWNER, {})).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });

  it('keeps synthetic secrets, descriptors and raw Oracle error text out of reports', () => {
    const secret = 'synthetic-password-wallet-token-and-bind';
    const error = Object.assign(new Error(secret), {
      errorNum: 1017,
      code: secret,
      classification: secret,
    });
    expect(safeFailure(error)).toEqual({ oracle: 1017, driver: null, classification: null });
    expect(JSON.stringify(safeFailure(error))).not.toContain(secret);
  });

  it('reports both missing owner credential fields and still allows runtime-only checks', () => {
    const runtime = {
      ORACLE_MIGRATION_CONFIRM: 'designated-development',
      ORACLE_MIGRATION_DB_UNIQUE_NAME: 'fce953xa',
      ORACLE_MIGRATION_TEST_CONFIRM: 'isolated-disposable-empty',
      ORACLE_CONNECT_STRING: 'tcps://unit.invalid:1522/unit',
      ORACLE_WALLET_DIRECTORY: resolve('unit-wallet-not-read'),
      ORACLE_WALLET_PASSWORD: 'PRIVATE_TEST_SENTINEL',
      ORACLE_API_PASSWORD: 'PRIVATE_TEST_SENTINEL',
      ORACLE_WORKER_PASSWORD: 'PRIVATE_TEST_SENTINEL',
    };
    expect(step10Configuration(runtime, { owners: false }).runtimes).toHaveLength(2);
    expect(() => step10Configuration(runtime)).toThrow(
      /ORACLE_MIGRATION_PASSWORD:.*ORACLE_STEP10_UPGRADE_PASSWORD:/,
    );
    expect(() => step10Configuration(runtime)).not.toThrow(/PRIVATE_TEST_SENTINEL|unit\.invalid/);
  });

  it('plans valid-shaped fixtures on both sides of every tenant-key test without issuing DML', async () => {
    const manifest = await loadManifest(fileURLToPath(new URL('../../', import.meta.url)));
    const execute = vi.fn(async (sql) => {
      if (sql.includes('FROM SPORTS')) return { rows: [{ ID: '1' }] };
      if (sql.includes('FROM PERMISSIONS')) return { rows: [['1']] };
      throw new Error('Fixture collection attempted an unexpected operation.');
    });
    const { rows, f } = await collectTenantFixtures({ execute }, manifest);
    expect(execute).toHaveBeenCalledTimes(2);
    const tables = new Map(
      manifest.migrations.flatMap((entry) => entry.tables).map((table) => [table.name, table]),
    );
    expect(requiredTenantColumn(tables.get('TENANTS'))).toBeUndefined();
    expect(requiredTenantColumn(tables.get('TENANT_USERS'))?.name).toBe('TENANT_ID');
    for (const [table, records] of rows) {
      const mandatory = tables
        .get(table)
        .columns.filter(
          (column) => !column.nullable && !column.identity && column.default === null,
        );
      for (const values of records) {
        expect(() => fixtureSql(manifest, table, values)).not.toThrow();
        for (const column of mandatory)
          expect(values[column.name], `${table}.${column.name}`).not.toBeUndefined();
      }
    }
    const foreign = manifest.migrations
      .flatMap((entry) => entry.constraints)
      .filter((constraint) => constraint.type === 'R');
    const scoped = foreign.filter((fk) =>
      fk.columns.some((column) => ['TENANT_ID', 'ACTIVE_TENANT_ID'].includes(column)),
    );
    expect(scoped).toHaveLength(68);
    for (const fk of scoped) {
      const scope = fk.columns.find((column) => ['TENANT_ID', 'ACTIVE_TENANT_ID'].includes(column));
      for (const tenant of f.tenants) {
        expect(
          rows
            .get(fk.table)
            ?.some(
              (row) =>
                row[scope] === tenant.tenant && fk.columns.every((column) => row[column] != null),
            ),
          fk.name,
        ).toBe(true);
      }
    }
  });
});
