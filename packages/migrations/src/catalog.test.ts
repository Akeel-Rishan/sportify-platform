import { describe, expect, it, vi } from 'vitest';
import {
  canonicalSql,
  canonicalIndexExpression,
  inspectHistoryPresence,
  verifyCatalog,
} from './catalog.js';
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
        DATA_LENGTH: 22,
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
    lobs: [] as Array<{
      TABLE_NAME: string;
      COLUMN_NAME: string;
      SEGMENT_NAME: string;
      INDEX_NAME: string;
    }>,
    indexes: [
      {
        INDEX_NAME: 'PK_UNIT_TABLE',
        TABLE_NAME: 'UNIT_TABLE',
        STATUS: 'VALID',
        INDEX_TYPE: 'NORMAL',
        UNIQUENESS: 'UNIQUE',
        FUNCIDX_STATUS: null as string | null,
      },
    ],
    indexColumns: [{ INDEX_NAME: 'PK_UNIT_TABLE', COLUMN_NAME: 'ID', COLUMN_POSITION: 1 }],
    indexExpressions: [] as Array<{
      INDEX_NAME: string;
      COLUMN_POSITION: number;
      COLUMN_EXPRESSION: string;
    }>,
  };
  const execute = vi.fn((sql: string) => {
    let rows: unknown[] = [];
    if (sql.includes('FROM USER_TABLES')) rows = actual.tables;
    else if (sql.includes('FROM USER_TAB_COLUMNS')) rows = actual.columns;
    else if (sql.includes('FROM USER_CONSTRAINTS')) rows = actual.constraints;
    else if (sql.includes('FROM USER_CONS_COLUMNS'))
      rows = [{ CONSTRAINT_NAME: 'PK_UNIT_TABLE', COLUMN_NAME: 'ID' }];
    else if (sql.includes('FROM USER_INDEXES')) rows = actual.indexes;
    else if (sql.includes('FROM USER_LOBS')) rows = actual.lobs;
    else if (sql.includes('FROM USER_IND_COLUMNS')) rows = actual.indexColumns;
    else if (sql.includes('FROM USER_IND_EXPRESSIONS')) rows = actual.indexExpressions;
    return Promise.resolve({ rows });
  });
  return { migration, actual, session: { execute } as unknown as MigrationSession };
}
describe('Oracle catalog comparison (unit metadata fixtures)', () => {
  it('matches observed simple CASE metadata only to the equivalent one-arm equality', () => {
    const searched = "CASE WHEN PAYMENT_STATUS = 'RECEIVED' THEN TENANT_ID END";
    expect(
      canonicalIndexExpression('CASE "PAYMENT_STATUS" WHEN \'RECEIVED\' THEN "TENANT_ID" END '),
    ).toBe(canonicalIndexExpression(searched));
    for (const different of [
      "CASE PAYMENT_STATUS WHEN 'received' THEN TENANT_ID END",
      "CASE PAYMENT_STATUS WHEN 'RECEIVED' THEN BOOKING_ID END",
      "CASE PAYMENT_STATUS WHEN 'RECEIVED' THEN TENANT_ID ELSE 0 END",
      "CASE PAYMENT_STATUS WHEN 'RECEIVED' THEN TENANT_ID WHEN 'VOIDED' THEN TENANT_ID END",
    ])
      expect(canonicalIndexExpression(different)).not.toBe(canonicalIndexExpression(searched));
    expect(canonicalIndexExpression("CASE STATUS WHEN 'A''B' THEN ID END")).toBe(
      canonicalIndexExpression("CASE WHEN STATUS = 'A''B' THEN ID END"),
    );
  });
  it('verifies actual Oracle CASE index spelling and still rejects changed semantics', async () => {
    const f = fixture();
    f.migration.tables[0]!.columns[0]!.type = 'VARCHAR2(20 CHAR)';
    Object.assign(f.actual.columns[0]!, {
      DATA_TYPE: 'VARCHAR2',
      DATA_PRECISION: null,
      DATA_SCALE: null,
      DATA_LENGTH: 80,
      CHAR_LENGTH: 20,
      CHAR_USED: 'C',
    });
    f.migration.indexes.push({
      name: 'UX_UNIT_CASE',
      table: 'UNIT_TABLE',
      unique: true,
      expressions: ["CASE WHEN ID = 'RECEIVED' THEN ID END"],
    });
    f.actual.indexes.push({
      INDEX_NAME: 'UX_UNIT_CASE',
      TABLE_NAME: 'UNIT_TABLE',
      STATUS: 'VALID',
      INDEX_TYPE: 'FUNCTION-BASED NORMAL',
      UNIQUENESS: 'UNIQUE',
      FUNCIDX_STATUS: 'ENABLED',
    });
    f.actual.indexColumns.push({
      INDEX_NAME: 'UX_UNIT_CASE',
      COLUMN_NAME: 'SYS_NC_CASE$',
      COLUMN_POSITION: 1,
    });
    f.actual.indexExpressions.push({
      INDEX_NAME: 'UX_UNIT_CASE',
      COLUMN_POSITION: 1,
      COLUMN_EXPRESSION: 'CASE "ID" WHEN \'RECEIVED\' THEN "ID" END ',
    });
    await expect(
      verifyCatalog(f.session, [f.migration], 'SPORTIFY_STEP08_TEST_OWNER'),
    ).resolves.toBeUndefined();
    f.actual.indexExpressions[0]!.COLUMN_EXPRESSION = 'CASE "ID" WHEN \'VOIDED\' THEN "ID" END';
    await expect(
      verifyCatalog(f.session, [f.migration], 'SPORTIFY_STEP08_TEST_OWNER'),
    ).rejects.toThrow(/CATALOG_MISMATCH/);
  });
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
  it('accepts internal LOB storage only for a matched extended VARCHAR2 column', async () => {
    const f = fixture();
    f.migration.tables[0]!.columns[0]!.type = 'VARCHAR2(2000 CHAR)';
    Object.assign(f.actual.columns[0]!, {
      DATA_TYPE: 'VARCHAR2',
      CHAR_LENGTH: 2000,
      CHAR_USED: 'C',
      DATA_LENGTH: 8000,
    });
    f.actual.lobs.push({
      TABLE_NAME: 'UNIT_TABLE',
      COLUMN_NAME: 'ID',
      SEGMENT_NAME: 'SYS_LOB_UNIT',
      INDEX_NAME: 'SYS_IL_UNIT',
    });
    f.actual.indexes.push({
      INDEX_NAME: 'SYS_IL_UNIT',
      TABLE_NAME: 'UNIT_TABLE',
      STATUS: 'VALID',
      INDEX_TYPE: 'LOB',
      UNIQUENESS: 'UNIQUE',
      FUNCIDX_STATUS: null,
    });
    await expect(
      verifyCatalog(f.session, [f.migration], 'SPORTIFY_TEST_OWNER'),
    ).resolves.toBeUndefined();
    f.actual.lobs[0]!.COLUMN_NAME = 'UNEXPECTED_COLUMN';
    await expect(verifyCatalog(f.session, [f.migration], 'SPORTIFY_TEST_OWNER')).rejects.toThrow(
      /CATALOG_MISMATCH/,
    );
  });
  it('rejects an internal LOB claim for an ordinary bounded column', async () => {
    const f = fixture();
    f.actual.lobs.push({
      TABLE_NAME: 'UNIT_TABLE',
      COLUMN_NAME: 'ID',
      SEGMENT_NAME: 'SYS_LOB_UNIT',
      INDEX_NAME: 'SYS_IL_UNIT',
    });
    await expect(verifyCatalog(f.session, [f.migration], 'SPORTIFY_TEST_OWNER')).rejects.toThrow(
      /CATALOG_MISMATCH/,
    );
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
