import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const rawPort = process.env.PORT ?? '4000';
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  await app.listen(Number(rawPort));
  console.info(`[api] Listening on port ${Number(rawPort)}; no routes are implemented.`);
}

bootstrap().catch(() => {
  console.error('[api] Startup failed. Check that PORT is valid (1-65535) and available.');
  process.exitCode = 1;
});
