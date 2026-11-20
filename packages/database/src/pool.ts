import { AsyncLocalStorage } from 'node:async_hooks';
import oracledb from 'oracledb';
import type { Connection, Pool, PoolAttributes, Result } from 'oracledb';
import type { DatabaseConfig, DatabaseRole } from './config.js';
import { DatabaseError, type DatabaseEvent, type DatabaseLog } from './errors.js';
import { validateWallet } from './wallet.js';

export type SqlBinds = Readonly<Record<string, string | number | null>>;
export interface SqlConnection {
  execute<Row = Record<string, unknown>>(sql: string, binds?: SqlBinds): Promise<Result<Row>>;
}
export interface Database {
  withConnection<T>(work: (connection: SqlConnection) => Promise<T>): Promise<T>;
  transaction<T>(work: (connection: SqlConnection) => Promise<T>): Promise<T>;
  query<Row = Record<string, unknown>>(sql: string, binds?: SqlBinds): Promise<Result<Row>>;
  check(): Promise<boolean>;
  stopAccepting(): void;
  close(): Promise<void>;
}
export type PoolFactory = (attributes: PoolAttributes) => Promise<Pool>;
export type DatabaseFactory = (config: DatabaseConfig, role: DatabaseRole) => Promise<Database>;

// Avoid binary floating-point conversion before the caller sees precise NUMBERs.
// Temporal columns require an explicit TO_CHAR projection, not local-time Date.
export function fetchTypeHandler(metadata: oracledb.Metadata<unknown>) {
  if (metadata.dbType === oracledb.DB_TYPE_NUMBER) return { type: oracledb.DB_TYPE_VARCHAR };
  if (
    [
      oracledb.DB_TYPE_DATE,
      oracledb.DB_TYPE_TIMESTAMP,
      oracledb.DB_TYPE_TIMESTAMP_LTZ,
      oracledb.DB_TYPE_TIMESTAMP_TZ,
    ].some((type) => type === metadata.dbType)
  )
    throw new DatabaseError('temporal_projection_required');
  return undefined;
}

export async function createDatabase(
  config: DatabaseConfig,
  role: DatabaseRole,
  factory: PoolFactory = (attributes) => oracledb.createPool(attributes),
  log: DatabaseLog = (record) => process.stdout.write(JSON.stringify(record) + '\n'),
): Promise<Database> {
  const report = (event: DatabaseEvent): void => {
    try {
      log({
        timestamp: new Date().toISOString(),
        severity: 'warn',
        service: `sportify-${role}`,
        event,
      });
    } catch {
      /* A log sink must never change connection ownership. */
    }
  };
  await validateWallet(config);
  let pool: Pool;
  try {
    pool = await factory({
      user: config.ORACLE_USER,
      password: config.ORACLE_PASSWORD,
      connectString: config.ORACLE_CONNECT_STRING,
      walletLocation: config.ORACLE_WALLET_DIRECTORY,
      walletPassword: config.ORACLE_WALLET_PASSWORD,
      sslServerDNMatch: true,
      sslAllowWeakDNMatch: false,
      connectTimeout: 5,
      transportConnectTimeout: 3,
      retryCount: 0,
      poolMin: config.ORACLE_POOL_MIN,
      poolMax: config.ORACLE_POOL_MAX,
      poolIncrement: config.ORACLE_POOL_INCREMENT,
      poolTimeout: config.ORACLE_POOL_IDLE_SECONDS,
      queueTimeout: config.ORACLE_QUEUE_TIMEOUT_MS,
      queueMax: role === 'api' ? 16 : 4,
      poolPingInterval: 60,
      poolPingTimeout: 1500,
    });
  } catch {
    report('oracle.pool.initialization_failed');
    throw new DatabaseError('unavailable');
  }
  let accepting = true;
  let closing: Promise<void> | undefined;
  const ownership = new AsyncLocalStorage<boolean>();

  async function scope<T>(
    work: (connection: SqlConnection) => Promise<T>,
    transaction: boolean,
  ): Promise<T> {
    if (!accepting) throw new DatabaseError('unavailable');
    if (ownership.getStore()) throw new DatabaseError('nested_scope');
    return ownership.run(true, async () => {
      let connection: Connection | undefined;
      let active = true;
      let failed = false;
      let dirty = false;
      let executing: Promise<unknown> | undefined;
      try {
        connection = await pool.getConnection();
        connection.callTimeout = config.ORACLE_CALL_TIMEOUT_MS;
        // Reset every checkout, even when the pool returns the same session.
        await connection.rollback();
        await connection.execute("ALTER SESSION SET TIME_ZONE = 'UTC'");
        if (!accepting) throw new DatabaseError('unavailable');
        const borrowed = connection;
        const facade: SqlConnection = {
          async execute<Row>(sql: string, binds: SqlBinds = {}): Promise<Result<Row>> {
            if (!active) throw new DatabaseError('scope_closed');
            if (executing) throw new DatabaseError('parallel_operation');
            for (const value of Object.values(binds)) {
              if (
                value !== null &&
                typeof value !== 'string' &&
                !(typeof value === 'number' && Number.isSafeInteger(value))
              )
                throw new DatabaseError('invalid_bind');
            }
            dirty = true;
            const operation = borrowed.execute<Row>(sql, binds, {
              autoCommit: false,
              outFormat: oracledb.OUT_FORMAT_OBJECT,
              maxRows: 1000,
              fetchTypeHandler,
            });
            executing = operation;
            try {
              return await operation;
            } finally {
              executing = undefined;
            }
          },
        };
        const result = await work(facade);
        active = false;
        // Detached calls must finish before rollback/release and cannot commit.
        if (executing) {
          await executing;
          throw new DatabaseError('scope_closed');
        }
        if (transaction) {
          await connection.commit();
          dirty = false;
        }
        return result;
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        active = false;
        if (executing) {
          try {
            await executing;
          } catch {
            /* Preserve callback failure. */
          }
        }
        let cleanupFailed = false;
        if (connection) {
          // Rollback even if callback failed before execute, or commit outcome
          // is uncertain. Never retry a write/commit automatically.
          try {
            if (dirty || !transaction || failed) await connection.rollback();
          } catch {
            cleanupFailed = true;
            report('oracle.rollback.failed');
          }
          try {
            await connection.close({ drop: cleanupFailed });
          } catch {
            cleanupFailed = true;
            report('oracle.release.failed');
          }
        }
        if (cleanupFailed && !failed) throw new DatabaseError('unavailable');
      }
    });
  }
  const database: Database = {
    withConnection: (work) => scope(work, false),
    transaction: (work) => scope(work, true),
    query: (sql, binds) => scope((connection) => connection.execute(sql, binds), false),
    async check() {
      try {
        const result = await database.query<{ PROBE: string; SESSION_ZONE: string }>(
          'SELECT :probe AS PROBE, SESSIONTIMEZONE AS SESSION_ZONE FROM DUAL',
          { probe: '1' },
        );
        return result.rows?.[0]?.PROBE === '1' && result.rows[0].SESSION_ZONE === 'UTC';
      } catch {
        report('oracle.probe.unavailable');
        return false;
      }
    },
    stopAccepting() {
      accepting = false;
    },
    close() {
      accepting = false;
      closing ??= pool
        .close(5)
        .catch(() => {
          report('oracle.pool.close_failed');
          throw new DatabaseError('unavailable');
        })
        .finally(() => ownership.disable());
      return closing;
    },
  };
  return database;
}
