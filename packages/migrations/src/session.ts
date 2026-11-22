import oracledb from 'oracledb';
import type { Connection, ConnectionAttributes } from 'oracledb';
import type { MigrationConfig } from './config.js';
import { validateWallet } from '@sportify/database';
import { MigrationError } from './errors.js';

export type MigrationSession = Pick<Connection, 'execute' | 'commit' | 'rollback' | 'close'>;
export type OwnerConnectionFactory = (attributes: ConnectionAttributes) => Promise<Connection>;
export type MigrationEvent = {
  event: 'migration.step' | 'migration.applied' | 'migration.failed' | 'migration.cleanup_failed';
  version: string;
  step?: string;
  checksum?: string;
  failureRecorded?: boolean;
};
export type MigrationLog = (event: MigrationEvent) => void;
export const safeLog: MigrationLog = (record) => {
  process.stdout.write(JSON.stringify(record) + '\n');
};

export async function withOwnerSession<T>(
  config: MigrationConfig,
  work: (session: MigrationSession) => Promise<T>,
  factory: OwnerConnectionFactory = (options) => oracledb.getConnection(options),
  log: MigrationLog = safeLog,
): Promise<T> {
  await validateWallet(config);
  let connection: Connection;
  try {
    connection = await factory({
      user: config.ORACLE_MIGRATION_USER,
      password: config.ORACLE_MIGRATION_PASSWORD,
      connectString: config.ORACLE_CONNECT_STRING,
      walletLocation: config.ORACLE_WALLET_DIRECTORY,
      walletPassword: config.ORACLE_WALLET_PASSWORD,
      sslServerDNMatch: true,
      sslAllowWeakDNMatch: false,
      connectTimeout: 5,
      transportConnectTimeout: 3,
      retryCount: 0,
    });
  } catch {
    throw new MigrationError('OWNER_CONNECTION_FAILED');
  }
  let failure = false;
  try {
    connection.callTimeout = 30_000;
    const identity = await connection.execute<{
      IDENTITY: string;
      SCHEMA_NAME: string;
      TARGET: string;
    }>(
      "SELECT SYS_CONTEXT('USERENV','SESSION_USER') AS IDENTITY, SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS SCHEMA_NAME, SYS_CONTEXT('USERENV','DB_UNIQUE_NAME') AS TARGET FROM DUAL",
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const row = identity.rows?.[0];
    if (
      !row ||
      row.IDENTITY !== config.ORACLE_MIGRATION_USER ||
      row.SCHEMA_NAME !== config.ORACLE_MIGRATION_SCHEMA ||
      row.TARGET !== config.ORACLE_MIGRATION_DB_UNIQUE_NAME
    )
      throw new MigrationError('TARGET_MISMATCH');
    const charset = await connection.execute<{ VALUE: string }>(
      "SELECT VALUE FROM NLS_DATABASE_PARAMETERS WHERE PARAMETER = 'NLS_CHARACTERSET'",
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    if (
      !Number.isSafeInteger(connection.oracleServerVersion) ||
      connection.oracleServerVersion < 1_900_000_000 ||
      charset.rows?.[0]?.VALUE !== 'AL32UTF8'
    )
      throw new MigrationError('CAPABILITY_MISMATCH');
    await connection.execute("ALTER SESSION SET TIME_ZONE = 'UTC'");
    await connection.execute('ALTER SESSION SET DDL_LOCK_TIMEOUT = 10');
    return await work(connection);
  } catch (error) {
    failure = true;
    throw error instanceof MigrationError ? error : new MigrationError('MIGRATION_FAILED');
  } finally {
    let cleanupFailed = false;
    try {
      await connection.rollback();
    } catch {
      cleanupFailed = true;
    }
    try {
      await connection.close();
    } catch {
      cleanupFailed = true;
    }
    if (cleanupFailed) {
      try {
        log({ event: 'migration.cleanup_failed', version: 'session' });
      } catch {
        /* no raw fallback */
      }
      if (!failure) throw new MigrationError('CLEANUP_FAILED');
    }
  }
}

export async function withMigrationLock<T>(
  session: MigrationSession,
  owner: string,
  work: () => Promise<T>,
  log: MigrationLog = safeLog,
): Promise<T> {
  let handle: string;
  try {
    const result = await session.execute<{ handle: string; result: number }>(
      `DECLARE
      lock_handle VARCHAR2(128);
    BEGIN
      DBMS_LOCK.ALLOCATE_UNIQUE(lockname => :name, lockhandle => lock_handle, expiration_secs => 864000);
      :result := DBMS_LOCK.REQUEST(lockhandle => lock_handle, lockmode => DBMS_LOCK.X_MODE, timeout => 10, release_on_commit => FALSE);
      :handle := lock_handle;
    END;`,
      {
        name: `SPORTIFY_MIGRATIONS:${owner}`,
        result: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        handle: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 128 },
      },
    );
    if (result.outBinds?.result !== 0 || !result.outBinds.handle)
      throw new MigrationError('LOCK_UNAVAILABLE');
    handle = result.outBinds.handle;
  } catch {
    throw new MigrationError('LOCK_UNAVAILABLE');
  }
  let failed = false;
  try {
    return await work();
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      const result = await session.execute<{ result: number }>(
        'BEGIN :result := DBMS_LOCK.RELEASE(lockhandle => :handle); END;',
        { handle, result: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
      );
      if (result.outBinds?.result !== 0) throw new MigrationError('LOCK_RELEASE_FAILED');
    } catch {
      try {
        log({ event: 'migration.cleanup_failed', version: 'lock' });
      } catch {
        /* no raw fallback */
      }
      if (!failed) throw new MigrationError('LOCK_RELEASE_FAILED');
    }
  }
}
