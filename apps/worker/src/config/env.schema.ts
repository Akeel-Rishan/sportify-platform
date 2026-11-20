import { parseDatabaseConfig, type DatabaseConfig } from '@sportify/database';
import { nodeEnvSchema, parseEnvironment, type Environment } from '@sportify/validation';
import { z } from 'zod';

export const workerEnvSchema = z.object({ NODE_ENV: nodeEnvSchema });
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function parseWorkerEnv(environment: Environment): WorkerEnv {
  return parseEnvironment(workerEnvSchema, environment, {
    NODE_ENV: 'expected development, test or production; empty values are invalid',
  });
}

export type WorkerConfig = WorkerEnv & { database: DatabaseConfig };
export function parseWorkerConfig(environment: Environment): WorkerConfig {
  return { ...parseWorkerEnv(environment), database: parseDatabaseConfig(environment, 'worker') };
}
