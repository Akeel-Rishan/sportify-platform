import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { parseApiEnv, type ApiEnv } from './config/env.schema.js';
import type { Environment } from '@sportify/validation';

export async function createApiApplication(config: ApiEnv): Promise<INestApplication> {
  // Validate injected typed configs too, before allocating Nest resources.
  parseApiEnv({ NODE_ENV: config.NODE_ENV, PORT: String(config.PORT) });
  const app = await NestFactory.create(AppModule, { logger: false });
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
