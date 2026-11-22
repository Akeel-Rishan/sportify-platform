import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadManifest,
  migrationChecksum,
  planMigrations,
  validateStatement,
  type LoadedManifest,
  type LoadedMigration,
  type HistoryRecord,
} from './manifest.js';
import { parseMigrationConfig } from './config.js';

export function migration(version: string): LoadedMigration {
  const item = {
    version,
    name: 'unit_fixture',
    kind: 'schema' as const,
    repairOf: null,
    files: [{ path: `migrations/${version}_unit/001_table.sql`, format: 'sql' as const }],
    tables: [
      {
        name: version === '000001' ? 'SCHEMA_MIGRATIONS' : 'UNIT_FIXTURE',
        columns: [{ name: 'ID', type: 'NUMBER', nullable: false, default: null, identity: false }],
      },
    ],
    constraints: [],
    indexes: [],
    seeds: [],
  };
  const statements = [
    { path: item.files[0]?.path ?? '', sql: 'CREATE TABLE UNIT_FIXTURE (ID NUMBER)\n' },
  ];
  return { ...item, statements, checksum: migrationChecksum(item, statements) };
}
export function manifest(...entries: LoadedMigration[]): LoadedManifest {
  return { format: 1, status: 'ready', blockedBy: [], migrations: entries };
}
function history(
  item: LoadedMigration,
  state = 'APPLIED',
  repair: string | null = null,
): HistoryRecord {
  return {
    VERSION: item.version,
    CHECKSUM: item.checksum,
    EXECUTION_STATUS: state,
    REPAIR_VERSION: repair,
  };
}
describe('migration planning/checksums (unit; not Oracle evidence)', () => {
  it('plans a clean run and a second run with nothing pending', () => {
    const a = migration('000001'),
      b = migration('000002');
    expect(planMigrations(manifest(a, b), [])).toEqual([a, b]);
    expect(planMigrations(manifest(a, b), [history(a), history(b)])).toEqual([]);
  });
  it('rejects changes to either exact SQL bytes or verification metadata', () => {
    const a = migration('000001');
    expect(migrationChecksum(a, a.statements)).toBe(a.checksum);
    expect(migrationChecksum(a, [{ sql: a.statements[0]?.sql + '\n' }])).not.toBe(a.checksum);
    expect(migrationChecksum({ ...a, name: 'changed' }, a.statements)).not.toBe(a.checksum);
    expect(() =>
      planMigrations(manifest(a), [{ ...history(a), CHECKSUM: '0'.repeat(64) }]),
    ).toThrow(/ARTIFACT_CHANGED/);
  });
  it.each(['RUNNING', 'FAILED', 'UNKNOWN'])('stops for unreconciled %s state', (state) => {
    const a = migration('000001');
    expect(() => planMigrations(manifest(a), [history(a, state)])).toThrow(/INCOMPLETE_HISTORY/);
  });
  it('rejects unknown versions, gaps and duplicate history', () => {
    const a = migration('000001'),
      b = migration('000002');
    expect(() => planMigrations(manifest(a), [history(b)])).toThrow(/UNKNOWN_HISTORY/);
    expect(() => planMigrations(manifest(a, b), [history(b)])).toThrow(/UNKNOWN_HISTORY/);
    expect(() => planMigrations(manifest(a), [history(a), history(a)])).toThrow(/UNKNOWN_HISTORY/);
  });
  it('accepts only a verified-checksum APPLIED repair explicitly linked to a retained FAILED row', () => {
    const a = migration('000001'),
      b = migration('000002');
    const repair = { ...migration('000003'), repairOf: '000001' };
    expect(
      planMigrations(manifest(a, b, repair), [history(a, 'FAILED', '000003'), history(repair)]),
    ).toEqual([b]);
    expect(() =>
      planMigrations(manifest(a, b, repair), [
        history(a, 'FAILED', '000003'),
        history(repair, 'RUNNING'),
      ]),
    ).toThrow(/INCOMPLETE_HISTORY/);
    expect(() =>
      planMigrations(manifest(a, b, repair), [
        history(a, 'FAILED', '000003'),
        { ...history(repair), CHECKSUM: 'f'.repeat(64) },
      ]),
    ).toThrow(/ARTIFACT_CHANGED/);
    expect(() => planMigrations(manifest(a, b, repair), [history(a), history(repair)])).toThrow(
      /UNKNOWN_HISTORY/,
    );
  });
  it('passes a whole PL/SQL block intact, rejects client delimiters and SQL terminators', () => {
    expect(() => validateStatement('BEGIN NULL; NULL; END;\n', 'plsql')).not.toThrow();
    for (const sql of ['BEGIN NULL; END;\n/\n', 'BEGIN NULL; END;\r\n', '\ufeffBEGIN NULL; END;\n'])
      expect(() => validateStatement(sql, 'plsql')).toThrow(/INVALID_ARTIFACT/);
    for (const sql of [
      'CREATE TABLE X (ID NUMBER);\n',
      'DROP TABLE X\n',
      'CREATE TABLE X (ID NUMBER)',
    ])
      expect(() => validateStatement(sql, 'sql')).toThrow(/INVALID_ARTIFACT/);
  });
});

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
it('loads only explicit canonical SQL files inside the database directory and refuses duplicates/order changes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sportify-manifest-unit-'));
  directories.push(directory);
  const entry = migration('000001');
  const folder = join(directory, 'migrations/000001_unit');
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, '001_table.sql'), entry.statements[0]?.sql ?? '');
  const { statements: _statements, checksum: _checksum, ...raw } = entry;
  const source = { format: 1, status: 'ready', blockedBy: [], migrations: [raw] };
  const path = join(directory, 'migrations/manifest.json');
  writeFileSync(path, JSON.stringify(source));
  expect((await loadManifest(directory)).migrations[0]?.checksum).toBe(entry.checksum);
  writeFileSync(join(folder, '001_table.sql'), 'CREATE TABLE X (ID NUMBER);\n');
  await expect(loadManifest(directory)).rejects.toThrow(/INVALID_ARTIFACT/);
  writeFileSync(path, JSON.stringify({ ...source, migrations: [{ ...raw, version: '000002' }] }));
  await expect(loadManifest(directory)).rejects.toThrow(/INVALID_ARTIFACT/);
  writeFileSync(
    path,
    JSON.stringify({
      ...source,
      migrations: [{ ...raw, files: [{ path: '../.env', format: 'sql' }] }],
    }),
  );
  await expect(loadManifest(directory)).rejects.toThrow(/INVALID_ARTIFACT/);
});

it('requires owner-only designated configuration and never echoes secret/descriptor input', () => {
  const input = {
    ORACLE_MIGRATION_CONFIRM: 'designated-development',
    ORACLE_MIGRATION_DB_UNIQUE_NAME: 'UNIT',
    ORACLE_MIGRATION_SCHEMA: 'SPORTIFY_SCHEMA_OWNER',
    ORACLE_MIGRATION_USER: 'SPORTIFY_SCHEMA_OWNER',
    ORACLE_MIGRATION_PASSWORD: 'SECRET_SENTINEL',
    ORACLE_CONNECT_STRING: 'tcps://unit.invalid:1522/unit',
    ORACLE_WALLET_DIRECTORY: resolve('unit-only'),
    ORACLE_WALLET_PASSWORD: 'WALLET_SENTINEL',
  };
  expect(parseMigrationConfig(input).ORACLE_MIGRATION_USER).toBe('SPORTIFY_SCHEMA_OWNER');
  for (const user of ['ADMIN', 'SPORTIFY_API', 'SPORTIFY_WORKER', 'SPORTIFY_TEST_OWNER']) {
    let failure: unknown;
    try {
      parseMigrationConfig({ ...input, ORACLE_MIGRATION_USER: user });
    } catch (error) {
      failure = error;
    }
    expect(String(failure)).toContain('ORACLE_MIGRATION_USER');
    expect(String(failure)).not.toContain('SECRET_SENTINEL');
    expect(String(failure)).not.toContain('unit.invalid');
  }
  expect(() => parseMigrationConfig({})).toThrow(/ORACLE_MIGRATION_CONFIRM/);
});
