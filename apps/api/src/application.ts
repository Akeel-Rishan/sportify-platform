import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { createDatabase, type DatabaseFactory } from '@sportify/database';
import { AppModule } from './app.module.js';
import { parseApiConfig, type ApiConfig } from './config/env.schema.js';
import type { Environment } from '@sportify/validation';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from './bootstrap/configure-app.js';
import type { LogSink } from './common/logging/request-logger.js';
import { verifyPasswordCorpus } from './modules/auth/password.js';
import type { RegistrationOwner } from './modules/auth/registration.service.js';
import type { AccountOwner } from './modules/auth/account.service.js';
export async function createApiApplication(
  config: ApiConfig,
  sink?: LogSink,
  databaseFactory: DatabaseFactory = createDatabase,
  registrationOwner?: RegistrationOwner,
  accountOwner?: AccountOwner,
): Promise<INestApplication> {
  const validated = parseApiConfig({
    NODE_ENV: config.NODE_ENV,
    PORT: String(config.PORT),
    ...Object.fromEntries(
      Object.entries(config.database).map(([key, value]) => [key, String(value)]),
    ),
  });
  if (config.registration) await verifyPasswordCorpus(config.registration.passwordBlocklist);
  if (config.account) {
    if (
      config.NODE_ENV === 'production' &&
      (!config.account.secureCookies ||
        config.account.dashboardOrigin.origin !== 'https://app.sportify.lk')
    )
      throw new Error(
        'Production account authentication requires the canonical HTTPS dashboard origin.',
      );
    if (config.NODE_ENV !== 'test' && accountOwner && accountOwner !== 'SPORTIFY_SCHEMA_OWNER')
      throw new Error('The disposable authentication owner is test-only.');
    if (config.account.passwordBlocklist !== config.registration?.passwordBlocklist)
      await verifyPasswordCorpus(config.account.passwordBlocklist);
  }
  const database = await databaseFactory(validated.database, 'api');
  try {
    // abortOnError:false lets us release the pool on Nest construction failure.
    const app = await NestFactory.create<NestExpressApplication>(
      AppModule.register(
        database,
        config.registration,
        registrationOwner,
        config.account,
        accountOwner,
      ),
      {
        logger: false,
        abortOnError: false,
      },
    );
    configureApp(app, sink, {
      environment: config.NODE_ENV,
      port: config.PORT,
      localDashboard: config.account?.dashboardOrigin,
    });
    app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
    return app;
  } catch (error) {
    await database.close().catch(() => {});
    throw error;
  }
}
export async function startApi(
  environment: Environment,
  databaseFactory: DatabaseFactory = createDatabase,
): Promise<INestApplication> {
  return listenApi(parseApiConfig(environment), databaseFactory);
}
export async function listenApi(
  config: ApiConfig,
  databaseFactory: DatabaseFactory = createDatabase,
): Promise<INestApplication> {
  const app = await createApiApplication(config, undefined, databaseFactory);
  try {
    await app.listen(config.PORT);
  } catch (error) {
    await app.close().catch(() => {});
    throw error;
  }
  return app;
}
