import { EnvironmentError } from '@sportify/validation';
import {
  parseMigrationConfig,
  withOwnerSession,
  withMigrationLock,
  MigrationError,
} from '@sportify/migrations';

try {
  const config = parseMigrationConfig(process.env);
  await withOwnerSession(config, (session) =>
    withMigrationLock(session, config.ORACLE_MIGRATION_SCHEMA, async () => {
      console.info(
        'PASS migration-owner identity/target/charset and session lock acquisition; lock will be released on this same connection. No business SQL executed.',
      );
    }),
  );
  console.info(
    'PASS migration lock released and owner connection closed. DDL-commit/concurrency behavior still requires the disposable suite.',
  );
} catch (error) {
  console.error(
    error instanceof EnvironmentError || error instanceof MigrationError
      ? error.message
      : 'Migration lock capability check failed; raw diagnostics suppressed.',
  );
  process.exitCode = 1;
}
