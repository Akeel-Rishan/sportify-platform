export {};

console.info('[worker] Idle. No jobs are configured; no services are connected.');

// A referenced, infrequent timer keeps this explicitly idle process alive.
// It performs no work and is released on either termination signal.
const idleTimer = setInterval(() => {}, 2_147_483_647);
let stopping = false;

function shutdown(signal: NodeJS.Signals): void {
  if (stopping) return;
  stopping = true;
  clearInterval(idleTimer);
  process.removeListener('SIGINT', onInterrupt);
  process.removeListener('SIGTERM', onTerminate);
  console.info(`[worker] ${signal} received; idle timer cleared. Shutdown complete.`);
}

const onInterrupt = (): void => shutdown('SIGINT');
const onTerminate = (): void => shutdown('SIGTERM');
process.on('SIGINT', onInterrupt);
process.on('SIGTERM', onTerminate);
