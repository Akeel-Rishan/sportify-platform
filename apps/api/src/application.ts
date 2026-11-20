import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { parseApiEnv, type ApiEnv } from './config/env.schema.js';
import type { Environment } from '@sportify/validation';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from './bootstrap/configure-app.js';
import type { LogSink } from './common/logging/request-logger.js';

export async function createApiApplication(
  config: ApiEnv,
  sink?: LogSink,
): Promise<INestApplication> {
  // Validate injected typed configs too, before allocating Nest resources.
  parseApiEnv({ NODE_ENV: config.NODE_ENV, PORT: String(config.PORT) });
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  configureApp(app, sink);
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  return app;
}

export async function startApi(environment: Environment): Promise<INestApplication> {
  const config = parseApiEnv(environment);
  const app = await createApiApplication(config);
  try {
    await app.listen(config.PORT);
  } catch (error) {
    await app.close();
    throw error;
  }
  return app;
}
