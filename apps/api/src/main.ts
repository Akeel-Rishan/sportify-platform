import { EnvironmentError } from '@sportify/validation';
import { loadApiEnv } from './config/env.js';
import { listenApi } from './application.js';

async function bootstrap(): Promise<void> {
  const config = loadApiEnv();
  await listenApi(config);
  console.info(`[api] Listening on port ${config.PORT}; application health routes only.`);
}

bootstrap().catch((error: unknown) => {
  console.error(
    error instanceof EnvironmentError
      ? `[api] ${error.message}`
      : '[api] Startup failed. Check runtime prerequisites and port availability.',
  );
  process.exitCode = 1;
});
