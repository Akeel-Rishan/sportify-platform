import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { z } from 'zod';
import { MigrationError } from './errors.js';

const identifier = z.string().regex(/^[A-Z][A-Z0-9_]{0,127}$/);
export const columnSchema = z.strictObject({
  name: identifier,
  type: z.string().min(1).max(100),
  nullable: z.boolean(),
  default: z.string().max(1000).nullable(),
  identity: z.boolean(),
});
export const tableSchema = z.strictObject({
  name: identifier,
  columns: z.array(columnSchema).min(1).max(100),
});
export const constraintSchema = z.strictObject({
  name: identifier,
  table: identifier,
  type: z.enum(['P', 'U', 'R', 'C']),
  columns: z.array(identifier).max(12),
  referencedTable: identifier.nullable(),
  referencedColumns: z.array(identifier).max(12),
  expression: z.string().max(5000).nullable(),
});
export const indexSchema = z.strictObject({
  name: identifier,
  table: identifier,
  unique: z.boolean(),
  expressions: z.array(z.string().min(1).max(1000)).min(1).max(12),
});
const entrySchema = z.strictObject({
  version: z.string().regex(/^\d{6}$/),
  name: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
  kind: z.enum(['schema', 'seed']),
  repairOf: z
    .string()
    .regex(/^\d{6}$/)
    .nullable(),
  files: z
    .array(
      z.strictObject({
        path: z.string().regex(/^(migrations|seeds)\/\d{6}_[a-z0-9_]+\/[a-z0-9_]+\.sql$/),
        format: z.enum(['sql', 'plsql']),
      }),
    )
    .min(1)
    .max(500),
  tables: z.array(tableSchema).max(40),
  constraints: z.array(constraintSchema).max(500),
  indexes: z.array(indexSchema).max(200),
  seeds: z
    .array(
      z.strictObject({
        table: identifier,
        key: identifier,
        values: z.array(z.string().min(1).max(100)).max(100),
      }),
    )
    .max(10),
});
export const manifestSchema = z.strictObject({
  format: z.literal(1),
  status: z.enum(['review', 'ready']),
  blockedBy: z.array(z.string().regex(/^[A-Z0-9_-]{1,80}$/)).max(20),
  migrations: z.array(entrySchema).min(1).max(200),
});
export type ManifestEntry = z.infer<typeof entrySchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type LoadedMigration = ManifestEntry & {
  checksum: string;
  statements: { path: string; sql: string }[];
};
export type LoadedManifest = Omit<Manifest, 'migrations'> & { migrations: LoadedMigration[] };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item))
        .join(',') +
      '}'
    );
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new MigrationError('INVALID_ARTIFACT');
  return encoded;
}
export function migrationChecksum(entry: ManifestEntry, files: readonly { sql: string }[]): string {
  const hash = createHash('sha256');
  const metadata: ManifestEntry = {
    version: entry.version,
    name: entry.name,
    kind: entry.kind,
    repairOf: entry.repairOf,
    files: entry.files,
    tables: entry.tables,
    constraints: entry.constraints,
    indexes: entry.indexes,
    seeds: entry.seeds,
  };
  for (const value of [canonical(metadata), ...files.map((file) => file.sql)]) {
    const bytes = Buffer.from(value, 'utf8');
    hash.update(String(bytes.length) + ':');
    hash.update(bytes);
  }
  return hash.digest('hex');
}
export function validateStatement(sql: string, format: 'sql' | 'plsql'): void {
  if (
    !sql.endsWith('\n') ||
    sql.includes('\r') ||
    sql.charCodeAt(0) === 0xfeff ||
    sql.includes('\0')
  )
    throw new MigrationError('INVALID_ARTIFACT');
  // Restricted authored format, not a general SQL parser. One file is one
  // execute() call. SQL files have no terminators; PL/SQL retains internal ;.
  const text = sql.trim();
  if (format === 'sql') {
    if (
      text.includes(';') ||
      !/^(CREATE TABLE|CREATE VIEW|CREATE (?:UNIQUE )?INDEX|ALTER TABLE|MERGE INTO|INSERT INTO)\s/i.test(
        text,
      )
    )
      throw new MigrationError('INVALID_ARTIFACT');
  } else if (!/^(BEGIN|DECLARE)\b/i.test(text) || !/END;$/i.test(text) || /^\s*\/\s*$/m.test(text))
    throw new MigrationError('INVALID_ARTIFACT');
}

export async function loadManifest(databaseDirectory: string): Promise<LoadedManifest> {
  try {
    const root = await realpath(databaseDirectory);
    const manifestPath = resolve(root, 'migrations/manifest.json');
    if ((await stat(manifestPath)).size > 2_000_000) throw new MigrationError('INVALID_ARTIFACT');
    const parsed: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
    const manifest = manifestSchema.parse(parsed);
    const migrations: LoadedMigration[] = [];
    const paths = new Set<string>();
    for (const entry of manifest.migrations) {
      if (entry.version !== String(migrations.length + 1).padStart(6, '0'))
        throw new MigrationError('INVALID_ARTIFACT');
      const statements: LoadedMigration['statements'] = [];
      for (const file of entry.files) {
        if (paths.has(file.path)) throw new MigrationError('INVALID_ARTIFACT');
        paths.add(file.path);
        if (!file.path.split('/')[1]?.startsWith(entry.version + '_'))
          throw new MigrationError('INVALID_ARTIFACT');
        const filename = await realpath(resolve(root, file.path));
        if (!filename.startsWith(root + sep) || (await stat(filename)).size > 2_000_000)
          throw new MigrationError('INVALID_ARTIFACT');
        const sql = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
          await readFile(filename),
        );
        validateStatement(sql, file.format);
        statements.push({ path: file.path, sql });
      }
      migrations.push({ ...entry, statements, checksum: migrationChecksum(entry, statements) });
    }
    return { ...manifest, migrations };
  } catch {
    throw new MigrationError('INVALID_ARTIFACT');
  }
}

export interface HistoryRecord {
  VERSION: string;
  CHECKSUM: string;
  EXECUTION_STATUS: string;
  REPAIR_VERSION: string | null;
}
export function planMigrations(
  manifest: LoadedManifest,
  history: readonly HistoryRecord[],
): LoadedMigration[] {
  const known = new Map(manifest.migrations.map((entry) => [entry.version, entry]));
  const rows = new Map(history.map((row) => [row.VERSION, row]));
  if (rows.size !== history.length) throw new MigrationError('UNKNOWN_HISTORY');
  for (const row of history) {
    const expected = known.get(row.VERSION);
    if (!expected) throw new MigrationError('UNKNOWN_HISTORY');
    if (row.CHECKSUM !== expected.checksum) throw new MigrationError('ARTIFACT_CHANGED');
    if (row.EXECUTION_STATUS === 'FAILED') {
      const repair = row.REPAIR_VERSION === null ? undefined : rows.get(row.REPAIR_VERSION);
      if (
        !repair ||
        repair.EXECUTION_STATUS !== 'APPLIED' ||
        repair.REPAIR_VERSION !== null ||
        known.get(repair.VERSION)?.repairOf !== row.VERSION ||
        repair.VERSION <= row.VERSION ||
        expected.repairOf !== null
      )
        throw new MigrationError('INCOMPLETE_HISTORY');
    } else if (row.EXECUTION_STATUS !== 'APPLIED' || row.REPAIR_VERSION !== null)
      throw new MigrationError('INCOMPLETE_HISTORY');
    if (expected.repairOf !== null && rows.get(expected.repairOf)?.REPAIR_VERSION !== row.VERSION)
      throw new MigrationError('UNKNOWN_HISTORY');
  }
  let missing = false;
  const pending: LoadedMigration[] = [];
  for (const entry of manifest.migrations) {
    if (entry.repairOf !== null) continue; // explicit operator repair path only
    if (!rows.has(entry.version)) {
      missing = true;
      pending.push(entry);
    } else if (missing) throw new MigrationError('UNKNOWN_HISTORY');
  }
  return pending;
}
