import { describe, expect, it, vi } from 'vitest';
import { canonicalSql, inspectHistoryPresence, verifyCatalog } from './catalog.js';
import type { MigrationSession } from './session.js';
import type { LoadedMigration } from './manifest.js';

function fixture() {
  const migration: LoadedMigration = {
    version: '000001',
    name: 'unit_catalog',
    kind: 'schema',
    repairOf: null,
    files: [],
    statements: [],
    checksum: 'a'.repeat(64),
    tables: [
      {
        name: 'UNIT_TABLE',
        columns: [
          { name: 'ID', type: 'NUMBER(5)', nullable: false, default: null, identity: false },
        ],
      },
    ],
    constraints: [
      {
        name: 'PK_UNIT_TABLE',
        table: 'UNIT_TABLE',
        type: 'P',
        columns: ['ID'],
        referencedTable: null,
        referencedColumns: [],
        expression: null,
      },
    ],
    indexes: [],
    seeds: [],
  };
  const actual = {
    tables: [{ TABLE_NAME: 'UNIT_TABLE' }],
    columns: [
      {
        TABLE_NAME: 'UNIT_TABLE',
        COLUMN_NAME: 'ID',
        DATA_TYPE: 'NUMBER',
        DATA_PRECISION: 5,
        DATA_SCALE: 0,
        CHAR_LENGTH: 0,
        CHAR_USED: null,
        NULLABLE: 'N',
        DATA_DEFAULT: null,
        IDENTITY_COLUMN: 'NO',
        DEFAULT_ON_NULL: 'NO',
        GENERATION_TYPE: null,
      },
    ],
    constraints: [
      {
        TABLE_NAME: 'UNIT_TABLE',
        CONSTRAINT_NAME: 'PK_UNIT_TABLE',
        CONSTRAINT_TYPE: 'P',
        STATUS: 'ENABLED',
        VALIDATED: 'VALIDATED',
        DEFERRABLE: 'NOT DEFERRABLE',
        DEFERRED: 'IMMEDIATE',
        DELETE_RULE: null,
        R_OWNER: null,
        R_CONSTRAINT_NAME: null,
        CONDITION_SQL: null,
      },
    ],
    indexes: [
      {
        INDEX_NAME: 'PK_UNIT_TABLE',
        TABLE_NAME: 'UNIT_TABLE',
        STATUS: 'VALID',
        INDEX_TYPE: 'NORMAL',
        UNIQUENESS: 'UNIQUE',
        FUNCIDX_STATUS: null,
      },
    ],
  };
  const execute = vi.fn((sql: string) => {
    let rows: unknown[] = [];
    if (sql.includes('FROM USER_TABLES')) rows = actual.tables;
    else if (sql.includes('FROM USER_TAB_COLUMNS')) rows = actual.columns;
    else if (sql.includes('FROM USER_CONSTRAINTS')) rows = actual.constraints;
    else if (sql.includes('FROM USER_CONS_COLUMNS'))
      rows = [{ CONSTRAINT_NAME: 'PK_UNIT_TABLE', COLUMN_NAME: 'ID' }];
    else if (sql.includes('FROM USER_INDEXES')) rows = actual.indexes;
    else if (sql.includes('FROM USER_IND_COLUMNS'))
      rows = [{ INDEX_NAME: 'PK_UNIT_TABLE', COLUMN_NAME: 'ID', COLUMN_POSITION: 1 }];
    return Promise.resolve({ rows });
  });
  return { migration, actual, session: { execute } as unknown as MigrationSession };
}
describe('Oracle catalog comparison (unit metadata fixtures)', () => {
  it('ignores Oracle identifier quoting/formatting but preserves literal meaning', () => {
    expect(canonicalSql(' "STATUS" = \'a b\' ')).toBe("STATUS='a b'");
    expect(canonicalSql("STATUS='A B'")).not.toBe(canonicalSql("STATUS='a b'"));
  });
  it('accepts matching metadata without querying application data', async () => {
    const f = fixture();
    await expect(
      verifyCatalog(f.session, [f.migration], 'SPORTIFY_TEST_OWNER'),
    ).resolves.toBeUndefined();
  });
  it.each([
    'extra_table',
    'wrong_precision',
    'wrong_nullability',
    'disabled_constraint',
    'not_validated',
    'unusable_index',
  ] as const)('refuses %s', async (mismatch) => {
    const f = fixture();
    if (mismatch === 'extra_table') f.actual.tables.push({ TABLE_NAME: 'UNREVIEWED_TABLE' });
    if (mismatch === 'wrong_precision') f.actual.columns[0]!.DATA_PRECISION = 6;
    if (mismatch === 'wrong_nullability') f.actual.columns[0]!.NULLABLE = 'Y';
    if (mismatch === 'disabled_constraint') f.actual.constraints[0]!.STATUS = 'DISABLED';
    if (mismatch === 'not_validated') f.actual.constraints[0]!.VALIDATED = 'NOT VALIDATED';
    if (mismatch === 'unusable_index') f.actual.indexes[0]!.STATUS = 'UNUSABLE';
    await expect(verifyCatalog(f.session, [f.migration], 'SPORTIFY_TEST_OWNER')).rejects.toThrow(
      /CATALOG_MISMATCH/,
    );
  });
  it('refuses a populated schema with no recognized registry', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ rows: [{ OBJECT_NAME: 'BUSINESS_DATA', OBJECT_TYPE: 'TABLE' }] });
    await expect(
      inspectHistoryPresence({ execute } as unknown as MigrationSession),
    ).rejects.toThrow(/POPULATED_UNKNOWN_SCHEMA/);
  });
});
