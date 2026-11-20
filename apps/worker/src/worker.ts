import { createDatabase, type DatabaseFactory } from '@sportify/database';
import type { WorkerConfig } from './config/env.schema.js';
import { parseWorkerConfig } from './config/env.schema.js';
export async function startWorker(
  config: WorkerConfig,
  log: (message: string) => void = console.info,
  databaseFactory: DatabaseFactory = createDatabase,
) {
  const validated = parseWorkerConfig({
    NODE_ENV: config.NODE_ENV,
    ...Object.fromEntries(
      Object.entries(config.database).map(([key, value]) => [key, String(value)]),
    ),
  });
  const database = await databaseFactory(validated.database, 'worker');
  let idleTimer: ReturnType<typeof setInterval> | undefined;
  let stopping: Promise<void> | undefined;
  function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (stopping) return stopping;
    database.stopAccepting();
    clearInterval(idleTimer);
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onTerminate);
    stopping = database
      .close()
      .then(() => log(`[worker] ${signal} received; pool closed. Shutdown complete.`));
    return stopping;
  }
  const stop = (signal: NodeJS.Signals): void => {
    void shutdown(signal).catch(() => {
      console.error('[worker] Pool shutdown failed.');
      process.exitCode = 1;
    });
  };
  const onInterrupt = (): void => stop('SIGINT');
  const onTerminate = (): void => stop('SIGTERM');
  try {
    idleTimer = setInterval(() => {}, 2_147_483_647);
    process.on('SIGINT', onInterrupt);
    process.on('SIGTERM', onTerminate);
    log(
      '[worker] Idle. No jobs are configured; Oracle pool initialized, connectivity not asserted.',
    );
    return { config: validated, shutdown };
  } catch (error) {
    await shutdown('SIGTERM').catch(() => {});
    throw error;
  }
}
