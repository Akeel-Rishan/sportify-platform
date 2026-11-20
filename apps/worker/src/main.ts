import { EnvironmentError } from '@sportify/validation';
import { loadWorkerEnv } from './config/env.js';
import { startWorker } from './worker.js';

async function bootstrap(): Promise<void> {
  const config = loadWorkerEnv();
  await startWorker(config);
}
bootstrap().catch((error: unknown) => {
  console.error(
    error instanceof EnvironmentError ? `[worker] ${error.message}` : '[worker] Startup failed.',
  );
  process.exitCode = 1;
});
