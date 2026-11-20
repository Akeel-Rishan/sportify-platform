import { EnvironmentError } from '@sportify/validation';
import { loadApiEnv } from './config/env.js';
import { startApi } from './application.js';

async function bootstrap(): Promise<void> {
  const config = loadApiEnv();
  await startApi({ NODE_ENV: config.NODE_ENV, PORT: String(config.PORT) });
  console.info(`[api] Listening on port ${config.PORT}; application health routes only.`);
}

bootstrap().catch((error: unknown) => {
  console.error(
    error instanceof EnvironmentError
      ? `[api] ${error.message}`
      : '[api] Startup failed. Check port availability.',
  );
  process.exitCode = 1;
});
