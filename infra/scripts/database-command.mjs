import { fileURLToPath } from 'node:url';
import { EnvironmentError } from '@sportify/validation';
import {
  loadManifest,
  parseMigrationConfig,
  withOwnerSession,
  migrateSession,
  statusSession,
  verifySession,
  assertReady,
  MigrationError,
} from '@sportify/migrations';

export async function databaseCommand(action) {
  try {
    const manifest = await loadManifest(fileURLToPath(new URL('../../database/', import.meta.url)));
    if (action === 'plan') {
      console.info(
        JSON.stringify({
          event: 'migration.plan',
          oracleValidated: false,
          status: manifest.status,
          blockedBy: manifest.blockedBy,
          artifacts: manifest.migrations.map((entry) => ({
            version: entry.version,
            name: entry.name,
            checksum: entry.checksum,
            statements: entry.statements.length,
          })),
        }),
      );
      return;
    }
    if (action !== 'status') assertReady(manifest);
    const config = parseMigrationConfig(process.env);
    await withOwnerSession(config, async (session) => {
      if (action === 'migrate') {
        const applied = await migrateSession(session, config.ORACLE_MIGRATION_SCHEMA, manifest);
        console.info(JSON.stringify({ event: 'migration.completed', applied }));
      } else if (action === 'verify') {
        await verifySession(session, config.ORACLE_MIGRATION_SCHEMA, manifest);
        console.info(JSON.stringify({ event: 'migration.verified' }));
      } else {
        const status = await statusSession(session, manifest);
        console.info(
          JSON.stringify({
            event: 'migration.status',
            history: status.history.map((row) => ({
              version: row.VERSION,
              state: row.EXECUTION_STATUS,
              repair: row.REPAIR_VERSION,
            })),
            pending: status.pending.map((entry) => entry.version),
            catalogVerified: false,
          }),
        );
      }
    });
  } catch (error) {
    console.error(
      error instanceof EnvironmentError || error instanceof MigrationError
        ? error.message
        : 'Migration command failed. Check operator prerequisites; raw diagnostics are suppressed.',
    );
    process.exitCode = 1;
  }
}
