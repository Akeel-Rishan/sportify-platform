import { createDatabase, parseDatabaseConfig } from '@sportify/database';
import { EnvironmentError } from '@sportify/validation';

export function verificationEnvironment() {
  if (
    process.env.ORACLE_VERIFY_CONFIRM !== 'designated-development' ||
    !/^[A-Za-z0-9_$#.-]{1,128}$/.test(process.env.ORACLE_VERIFY_DB_UNIQUE_NAME ?? '')
  ) {
    throw new Error(
      'Live Oracle prerequisites missing: designate an authorized development/pilot target with ORACLE_VERIFY_CONFIRM and ORACLE_VERIFY_DB_UNIQUE_NAME. No connection attempted.',
    );
  }
  // Validate BOTH identities before connecting either one. Do not load app .env files.
  return ['api', 'worker'].map((role) => ({
    role,
    config: parseDatabaseConfig(
      {
        ...process.env,
        ORACLE_USER: `SPORTIFY_${role.toUpperCase()}`,
        ORACLE_PASSWORD: process.env[`ORACLE_${role.toUpperCase()}_PASSWORD`],
        ORACLE_POOL_MIN: '0',
        ORACLE_POOL_MAX: '1',
        ORACLE_POOL_INCREMENT: '1',
      },
      role,
    ),
  }));
}
export function requireCondition(condition) {
  if (!condition)
    throw new Error(
      'Oracle verification assertion failed. Inspect the named check with the authorized operator; raw database diagnostics are suppressed.',
    );
}
export async function withVerifiedTarget(entry, work) {
  const database = await createDatabase(entry.config, entry.role);
  let failed = false;
  let failure;
  try {
    const identity = await database.query(`SELECT SYS_CONTEXT('USERENV','DB_UNIQUE_NAME') AS TARGET,
      SYS_CONTEXT('USERENV','SESSION_USER') AS IDENTITY FROM DUAL`);
    requireCondition(
      identity.rows?.[0]?.TARGET === process.env.ORACLE_VERIFY_DB_UNIQUE_NAME &&
        identity.rows[0].IDENTITY === entry.config.ORACLE_USER,
    );
    await work(database);
  } catch (error) {
    failed = true;
    failure = error;
  } finally {
    try {
      await database.close();
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    }
  }
  if (failed) throw failure;
}
export function reportFailure(error) {
  // Only authored prerequisite text is allowed; never print driver errors/stack/config.
  const text =
    error instanceof EnvironmentError
      ? error.message
      : error instanceof Error && error.message.startsWith('Live Oracle prerequisites missing:')
        ? error.message
        : 'Oracle verification FAILED. Check secure configuration, target, TLS, identity and privileges with the operator. Raw diagnostics suppressed.';
  console.error(text);
  process.exitCode = 1;
}
