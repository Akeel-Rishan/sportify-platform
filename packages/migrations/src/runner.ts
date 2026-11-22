import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import oracledb from 'oracledb';
import type { LoadedManifest, LoadedMigration, HistoryRecord } from './manifest.js';
import { planMigrations } from './manifest.js';
import { MigrationError } from './errors.js';
import { inspectHistoryPresence, verifyCatalog } from './catalog.js';
import { withMigrationLock, type MigrationSession, type MigrationLog, safeLog } from './session.js';

export async function readHistory(session: MigrationSession): Promise<HistoryRecord[]> {
  const result = await session.execute<HistoryRecord>(
    'SELECT VERSION, CHECKSUM, EXECUTION_STATUS, REPAIR_VERSION FROM SCHEMA_MIGRATIONS ORDER BY VERSION',
    {},
    { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: 1000 },
  );
  if ((result.rows?.length ?? 0) >= 1000) throw new MigrationError('UNKNOWN_HISTORY');
  return result.rows ?? [];
}
export function assertReady(manifest: LoadedManifest): void {
  if (manifest.status !== 'ready' || manifest.blockedBy.length)
    throw new MigrationError('DESIGN_REVIEW_REQUIRED');
}
function report(log: MigrationLog, record: Parameters<MigrationLog>[0]): void {
  try {
    log(record);
  } catch {
    /* Never fall back to raw database/config logging. */
  }
}
export async function migrateSession(
  session: MigrationSession,
  owner: string,
  manifest: LoadedManifest,
  log: MigrationLog = safeLog,
  verify: typeof verifyCatalog = verifyCatalog,
): Promise<string[]> {
  assertReady(manifest);
  return withMigrationLock(session, owner, async () => {
    let exists = await inspectHistoryPresence(session);
    const history = exists ? await readHistory(session) : [];
    if (exists && history.length === 0) throw new MigrationError('UNKNOWN_HISTORY');
    const pending = planMigrations(manifest, history);
    const completed = manifest.migrations.filter((entry) =>
      history.some((row) => row.VERSION === entry.version),
    );
    if (exists) await verify(session, completed, owner);
    const changed: string[] = [];
    for (const entry of pending) {
      const started = performance.now();
      let registered = false;
      let bootstrap = false;
      try {
        if (!exists) {
          // Explicit first, password-free history CREATE statement; crash here
          // leaves an unknown registry, which must be reconciled, never adopted.
          if (
            entry.version !== '000001' ||
            entry.kind !== 'schema' ||
            entry.statements.length < 1 ||
            entry.tables.length !== 1 ||
            entry.tables[0]?.name !== 'SCHEMA_MIGRATIONS'
          )
            throw new MigrationError('INVALID_ARTIFACT');
          await session.execute(entry.statements[0]?.sql ?? '');
          exists = true;
          bootstrap = true;
        }
        await session.execute(
          `INSERT INTO SCHEMA_MIGRATIONS
          (VERSION, DESCRIPTION, CHECKSUM, RUNNER_ID, EXECUTION_STATUS)
          VALUES (:version, :description, :checksum, :runner, 'RUNNING')`,
          {
            version: entry.version,
            description: entry.name,
            checksum: entry.checksum,
            runner: randomUUID(),
          },
          { autoCommit: false },
        );
        await session.commit();
        registered = true;
        for (const statement of bootstrap ? entry.statements.slice(1) : entry.statements) {
          report(log, {
            event: 'migration.step',
            version: entry.version,
            step: statement.path,
            checksum: entry.checksum,
          });
          await session.execute(statement.sql, {}, { autoCommit: false });
        }
        // Seed DML remains uncommitted until both its postconditions and its
        // APPLIED transition succeed in the same transaction.
        await verify(session, [...completed, entry], owner);
        const transition = await session.execute(
          `UPDATE SCHEMA_MIGRATIONS SET EXECUTION_STATUS='APPLIED',
          INSTALLED_AT_UTC=LOCALTIMESTAMP, FINISHED_AT_UTC=LOCALTIMESTAMP, EXECUTION_MS=:elapsed
          WHERE VERSION=:version AND EXECUTION_STATUS='RUNNING'`,
          { version: entry.version, elapsed: Math.floor(performance.now() - started) },
          { autoCommit: false },
        );
        if (transition.rowsAffected !== 1) throw new MigrationError('HISTORY_WRITE_FAILED');
        await session.commit();
        completed.push(entry);
        changed.push(entry.version);
        report(log, {
          event: 'migration.applied',
          version: entry.version,
          checksum: entry.checksum,
        });
      } catch {
        // DDL before failure can already be committed; retain exact failed
        // checksum/state and never continue. Lost commits stay uncertain.
        let failure: 'MIGRATION_FAILED' | 'HISTORY_WRITE_FAILED' = 'MIGRATION_FAILED';
        let failureRecorded = false;
        try {
          await session.rollback();
        } catch {
          report(log, { event: 'migration.cleanup_failed', version: entry.version });
        }
        if (registered) {
          try {
            const transition = await session.execute(
              `UPDATE SCHEMA_MIGRATIONS SET EXECUTION_STATUS='FAILED',
              FINISHED_AT_UTC=LOCALTIMESTAMP, EXECUTION_MS=:elapsed, ERROR_CODE='MIGRATION_FAILED'
              WHERE VERSION=:version AND EXECUTION_STATUS='RUNNING'`,
              { version: entry.version, elapsed: Math.floor(performance.now() - started) },
              { autoCommit: false },
            );
            if (transition.rowsAffected !== 1) throw new MigrationError('HISTORY_WRITE_FAILED');
            await session.commit();
            failureRecorded = true;
          } catch {
            failure = 'HISTORY_WRITE_FAILED';
          }
        }
        report(log, {
          event: 'migration.failed',
          version: entry.version,
          checksum: entry.checksum,
          failureRecorded,
        });
        throw new MigrationError(failure);
      }
    }
    return changed;
  });
}

export async function statusSession(
  session: MigrationSession,
  manifest: LoadedManifest,
): Promise<{ history: HistoryRecord[]; pending: LoadedMigration[] }> {
  const exists = await inspectHistoryPresence(session);
  const history = exists ? await readHistory(session) : [];
  if (exists && history.length === 0) throw new MigrationError('UNKNOWN_HISTORY');
  return { history, pending: planMigrations(manifest, history) };
}
export async function verifySession(
  session: MigrationSession,
  owner: string,
  manifest: LoadedManifest,
): Promise<void> {
  assertReady(manifest);
  await withMigrationLock(session, owner, async () => {
    const status = await statusSession(session, manifest);
    if (status.pending.length) throw new MigrationError('INCOMPLETE_HISTORY');
    await verifyCatalog(
      session,
      manifest.migrations.filter((entry) =>
        status.history.some((row) => row.VERSION === entry.version),
      ),
      owner,
    );
  });
}
