import { EnvironmentError } from '@sportify/validation';
import { loadWorkerEnv } from './config/env.js';
import { startWorker } from './worker.js';

try {
  const config = loadWorkerEnv();
  startWorker(config);
} catch (error: unknown) {
  console.error(
    error instanceof EnvironmentError ? `[worker] ${error.message}` : '[worker] Startup failed.',
  );
  process.exitCode = 1;
}
