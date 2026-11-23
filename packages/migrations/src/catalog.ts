import oracledb from 'oracledb';
import type { MigrationSession } from './session.js';
import type { LoadedMigration } from './manifest.js';
import { MigrationError } from './errors.js';

export function canonicalSql(sql: string | null): string {
  if (sql === null) return '';
  return (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\S/g) ?? [])
    .map((token) => (token.startsWith("'") ? token : token.replaceAll('"', '').toUpperCase()))
    .join('');
}
export function canonicalIndexExpression(sql: string): string {
  // Observed on the Step 09 subscription index: Oracle expands a searched
  // CASE ... IN (...) into simple CASE arms with the same return identifier.
  // Accept only that restricted shape, preserving literal spelling and order.
  // No ELSE, expressions, changed selectors or differing return arms are folded.
  const tokens = sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Z][A-Z0-9_$#]*|\S/gi) ?? [];
  const identifier = /^(?:"(?:""|[^"])*"|[A-Z][A-Z0-9_$#]*)$/i;
  const literal = /^'(?:''|[^'])*'$/;
  if (
    tokens.length >= 11 &&
    (tokens.length - 3) % 4 === 0 &&
    tokens[0]?.toUpperCase() === 'CASE' &&
    tokens.at(-1)?.toUpperCase() === 'END' &&
    identifier.test(tokens[1] ?? '')
  ) {
    const values: string[] = [];
    const result = tokens[5] ?? '';
    let valid = identifier.test(result);
    for (let i = 2; i < tokens.length - 1; i += 4) {
      if (
        tokens[i]?.toUpperCase() !== 'WHEN' ||
        !literal.test(tokens[i + 1] ?? '') ||
        tokens[i + 2]?.toUpperCase() !== 'THEN' ||
        !identifier.test(tokens[i + 3] ?? '') ||
        canonicalSql(tokens[i + 3] ?? '') !== canonicalSql(result)
      )
        valid = false;
      values.push(tokens[i + 1] ?? '');
    }
    if (valid)
      return canonicalSql(`CASE WHEN ${tokens[1]} IN (${values.join(',')}) THEN ${result} END`);
  }
  // Oracle can store a single equality CASE as simple CASE. Normalize only
  // identifier / string-literal / identifier with one arm and no ELSE.
  // Leave general SQL, literal contents and differing branches unchanged.
  const simple =
    /^\s*CASE\s+("(?:""|[^"])*"|[A-Z][A-Z0-9_$#]*)\s+WHEN\s+('(?:''|[^'])*')\s+THEN\s+("(?:""|[^"])*"|[A-Z][A-Z0-9_$#]*)\s+END\s*$/i.exec(
      sql,
    );
  return canonicalSql(simple ? `CASE WHEN ${simple[1]} = ${simple[2]} THEN ${simple[3]} END` : sql);
}
export async function rows<Row>(session: MigrationSession, sql: string): Promise<Row[]> {
  const result = await session.execute<Row>(
    sql,
    {},
    { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: 20000 },
  );
  if ((result.rows?.length ?? 0) >= 20000) throw new MigrationError('CATALOG_MISMATCH');
  return result.rows ?? [];
}
export async function inspectHistoryPresence(session: MigrationSession): Promise<boolean> {
  const objects = await rows<{ OBJECT_NAME: string; OBJECT_TYPE: string }>(
    session,
    'SELECT OBJECT_NAME, OBJECT_TYPE FROM USER_OBJECTS WHERE SUBOBJECT_NAME IS NULL',
  );
  const history = objects.filter(
    (row) => row.OBJECT_NAME === 'SCHEMA_MIGRATIONS' && row.OBJECT_TYPE === 'TABLE',
  );
  if (!history.length && objects.length) throw new MigrationError('POPULATED_UNKNOWN_SCHEMA');
  return history.length === 1;
}

interface ColumnRow {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
  DATA_PRECISION: number | null;
  DATA_SCALE: number | null;
  DATA_LENGTH: number;
  CHAR_LENGTH: number;
  CHAR_USED: string | null;
  NULLABLE: string;
  DATA_DEFAULT: string | null;
  IDENTITY_COLUMN: string;
  DEFAULT_ON_NULL: string;
  GENERATION_TYPE: string | null;
}
function columnType(row: ColumnRow): string {
  if (row.DATA_TYPE === 'NUMBER')
    return row.DATA_PRECISION === null
      ? 'NUMBER'
      : row.DATA_SCALE === 0
        ? `NUMBER(${row.DATA_PRECISION})`
        : `NUMBER(${row.DATA_PRECISION},${row.DATA_SCALE})`;
  if (['VARCHAR2', 'CHAR'].includes(row.DATA_TYPE))
    return `${row.DATA_TYPE}(${row.CHAR_LENGTH} ${row.CHAR_USED === 'C' ? 'CHAR' : 'BYTE'})`;
  return row.DATA_TYPE;
}
interface ConstraintRow {
  TABLE_NAME: string;
  CONSTRAINT_NAME: string;
  CONSTRAINT_TYPE: string;
  STATUS: string;
  VALIDATED: string;
  DEFERRABLE: string;
  DEFERRED: string;
  DELETE_RULE: string | null;
  R_OWNER: string | null;
  R_CONSTRAINT_NAME: string | null;
  CONDITION_SQL: string | null;
}
interface ConstraintColumn {
  CONSTRAINT_NAME: string;
  COLUMN_NAME: string;
}
interface IndexRow {
  INDEX_NAME: string;
  TABLE_NAME: string;
  STATUS: string;
  INDEX_TYPE: string;
  UNIQUENESS: string;
  FUNCIDX_STATUS: string | null;
}
interface IndexColumn {
  INDEX_NAME: string;
  COLUMN_NAME: string;
  COLUMN_POSITION: number;
}
interface IndexExpression {
  INDEX_NAME: string;
  COLUMN_POSITION: number;
  COLUMN_EXPRESSION: string;
}
interface LobRow {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  SEGMENT_NAME: string;
  INDEX_NAME: string;
}

export async function verifyCatalog(
  session: MigrationSession,
  applied: readonly LoadedMigration[],
  owner: string,
): Promise<void> {
  const tables = new Map(
    applied.flatMap((entry) => entry.tables).map((table) => [table.name, table]),
  );
  const expectedConstraints = new Map(
    applied
      .flatMap((entry) => entry.constraints)
      .map((constraint) => [constraint.name, constraint]),
  );
  const expectedIndexes = new Map(
    applied.flatMap((entry) => entry.indexes).map((index) => [index.name, index]),
  );
  const actualTables = await rows<{ TABLE_NAME: string }>(
    session,
    'SELECT TABLE_NAME FROM USER_TABLES',
  );
  if (
    actualTables.length !== tables.size ||
    actualTables.some((row) => !tables.has(row.TABLE_NAME))
  )
    throw new MigrationError('CATALOG_MISMATCH');
  const columns = await rows<ColumnRow>(
    session,
    `SELECT c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE, c.DATA_PRECISION,
    c.DATA_SCALE, c.DATA_LENGTH, c.CHAR_LENGTH, c.CHAR_USED, c.NULLABLE, c.DATA_DEFAULT, c.IDENTITY_COLUMN, c.DEFAULT_ON_NULL,
    i.GENERATION_TYPE FROM USER_TAB_COLUMNS c LEFT JOIN USER_TAB_IDENTITY_COLS i
    ON i.TABLE_NAME=c.TABLE_NAME AND i.COLUMN_NAME=c.COLUMN_NAME`,
  );
  for (const table of tables.values()) {
    const actual = columns.filter((row) => row.TABLE_NAME === table.name);
    if (actual.length !== table.columns.length) throw new MigrationError('CATALOG_MISMATCH');
    for (const column of table.columns) {
      const found = actual.find((row) => row.COLUMN_NAME === column.name);
      if (
        !found ||
        columnType(found) !== column.type ||
        (found.NULLABLE === 'Y') !== column.nullable ||
        (found.IDENTITY_COLUMN === 'YES') !== column.identity
      )
        throw new MigrationError('CATALOG_MISMATCH');
      if (column.identity) {
        if (found.GENERATION_TYPE !== 'BY DEFAULT' || found.DEFAULT_ON_NULL !== 'YES')
          throw new MigrationError('CATALOG_MISMATCH');
      } else if (canonicalSql(found.DATA_DEFAULT) !== canonicalSql(column.default))
        throw new MigrationError('CATALOG_MISMATCH');
    }
  }
  const constraints = await rows<ConstraintRow>(
    session,
    `SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE,
    STATUS, VALIDATED, DEFERRABLE, DEFERRED, DELETE_RULE, R_OWNER, R_CONSTRAINT_NAME,
    SEARCH_CONDITION_VC AS CONDITION_SQL FROM USER_CONSTRAINTS WHERE GENERATED='USER NAME'`,
  );
  const constraintColumns = await rows<ConstraintColumn>(
    session,
    'SELECT CONSTRAINT_NAME, COLUMN_NAME FROM USER_CONS_COLUMNS ORDER BY CONSTRAINT_NAME, POSITION',
  );
  const columnNames = (name: string) =>
    constraintColumns.filter((row) => row.CONSTRAINT_NAME === name).map((row) => row.COLUMN_NAME);
  if (constraints.length !== expectedConstraints.size) throw new MigrationError('CATALOG_MISMATCH');
  for (const actual of constraints) {
    const expected = expectedConstraints.get(actual.CONSTRAINT_NAME);
    if (
      !expected ||
      actual.TABLE_NAME !== expected.table ||
      actual.CONSTRAINT_TYPE !== expected.type ||
      actual.STATUS !== 'ENABLED' ||
      actual.VALIDATED !== 'VALIDATED' ||
      actual.DEFERRABLE !== 'NOT DEFERRABLE' ||
      actual.DEFERRED !== 'IMMEDIATE'
    )
      throw new MigrationError('CATALOG_MISMATCH');
    if (
      expected.type !== 'C' &&
      JSON.stringify(columnNames(actual.CONSTRAINT_NAME)) !== JSON.stringify(expected.columns)
    )
      throw new MigrationError('CATALOG_MISMATCH');
    if (
      expected.type === 'C' &&
      canonicalSql(actual.CONDITION_SQL) !== canonicalSql(expected.expression)
    )
      throw new MigrationError('CATALOG_MISMATCH');
    if (expected.type === 'R') {
      const parent = constraints.find((row) => row.CONSTRAINT_NAME === actual.R_CONSTRAINT_NAME);
      if (
        !parent ||
        parent.TABLE_NAME !== expected.referencedTable ||
        actual.R_OWNER !== owner ||
        actual.DELETE_RULE !== 'NO ACTION' ||
        JSON.stringify(columnNames(parent.CONSTRAINT_NAME)) !==
          JSON.stringify(expected.referencedColumns)
      )
        throw new MigrationError('CATALOG_MISMATCH');
    }
  }
  const indexes = await rows<IndexRow>(
    session,
    'SELECT INDEX_NAME, TABLE_NAME, STATUS, INDEX_TYPE, UNIQUENESS, FUNCIDX_STATUS FROM USER_INDEXES',
  );
  const lobs = await rows<LobRow>(
    session,
    'SELECT TABLE_NAME, COLUMN_NAME, SEGMENT_NAME, INDEX_NAME FROM USER_LOBS',
  );
  // Oracle stores extended VARCHAR2 columns using internal LOBs. The exact
  // declared column type/length was verified above; accept storage only for
  // those matched columns whose actual maximum byte length exceeds 4000.
  const expectedLobs = columns
    .filter(
      (column) =>
        ['CLOB', 'NCLOB', 'BLOB'].includes(column.DATA_TYPE) ||
        (column.DATA_TYPE === 'VARCHAR2' && column.DATA_LENGTH > 4000),
    )
    .map((column) => ({ table: column.TABLE_NAME, column: column.COLUMN_NAME }));
  if (
    lobs.length !== expectedLobs.length ||
    lobs.some(
      (lob) =>
        !expectedLobs.some(
          (expected) => expected.table === lob.TABLE_NAME && expected.column === lob.COLUMN_NAME,
        ),
    )
  )
    throw new MigrationError('CATALOG_MISMATCH');
  const indexColumns = await rows<IndexColumn>(
    session,
    'SELECT INDEX_NAME, COLUMN_NAME, COLUMN_POSITION FROM USER_IND_COLUMNS ORDER BY INDEX_NAME, COLUMN_POSITION',
  );
  const expressions = await rows<IndexExpression>(
    session,
    'SELECT INDEX_NAME, COLUMN_POSITION, COLUMN_EXPRESSION FROM USER_IND_EXPRESSIONS',
  );
  const backing = new Set(
    constraints
      .filter((row) => ['P', 'U'].includes(row.CONSTRAINT_TYPE))
      .map((row) => row.CONSTRAINT_NAME),
  );
  for (const index of indexes) {
    const lob =
      index.INDEX_TYPE === 'LOB' &&
      lobs.some(
        (row) => row.INDEX_NAME === index.INDEX_NAME && row.TABLE_NAME === index.TABLE_NAME,
      );
    if (
      index.STATUS !== 'VALID' ||
      (index.FUNCIDX_STATUS !== null && index.FUNCIDX_STATUS !== 'ENABLED') ||
      (!backing.has(index.INDEX_NAME) && !expectedIndexes.has(index.INDEX_NAME) && !lob)
    )
      throw new MigrationError('CATALOG_MISMATCH');
  }
  for (const expected of expectedIndexes.values()) {
    const index = indexes.find((row) => row.INDEX_NAME === expected.name);
    const actual = indexColumns
      .filter((row) => row.INDEX_NAME === expected.name)
      .map(
        (row) =>
          expressions.find(
            (expression) =>
              expression.INDEX_NAME === row.INDEX_NAME &&
              expression.COLUMN_POSITION === row.COLUMN_POSITION,
          )?.COLUMN_EXPRESSION ?? row.COLUMN_NAME,
      );
    if (
      !index ||
      index.TABLE_NAME !== expected.table ||
      (index.UNIQUENESS === 'UNIQUE') !== expected.unique ||
      JSON.stringify(actual.map(canonicalIndexExpression)) !==
        JSON.stringify(expected.expressions.map(canonicalIndexExpression))
    )
      throw new MigrationError('CATALOG_MISMATCH');
  }
  if ((await rows(session, "SELECT OBJECT_NAME FROM USER_OBJECTS WHERE STATUS <> 'VALID'")).length)
    throw new MigrationError('CATALOG_MISMATCH');
  for (const entry of applied)
    for (const seed of entry.seeds)
      for (const code of seed.values) {
        const result = await session.execute<{ TOTAL: number }>(
          `SELECT COUNT(*) AS TOTAL FROM "${seed.table}" WHERE "${seed.key}" = :code`,
          { code },
          { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        if (result.rows?.[0]?.TOTAL !== 1) throw new MigrationError('CATALOG_MISMATCH');
      }
}
