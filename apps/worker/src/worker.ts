import type { Environment } from '@sportify/validation';
import { parseWorkerEnv } from './config/env.schema.js';

export function startWorker(
  environment: Environment,
  log: (message: string) => void = console.info,
) {
  const config = parseWorkerEnv(environment);
  // Keep the process explicitly idle without polling or external connections.
  const idleTimer = setInterval(() => {}, 2_147_483_647);
  let stopping = false;

  function shutdown(signal: NodeJS.Signals): void {
    if (stopping) return;
    stopping = true;
    clearInterval(idleTimer);
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onTerminate);
    log(`[worker] ${signal} received; idle timer cleared. Shutdown complete.`);
  }

  const onInterrupt = (): void => shutdown('SIGINT');
  const onTerminate = (): void => shutdown('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  log('[worker] Idle. No jobs are configured; no services are connected.');
  return { config, shutdown };
}
