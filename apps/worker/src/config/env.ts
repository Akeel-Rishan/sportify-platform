import { resolve } from 'node:path';
import { config } from 'dotenv';
import { EnvironmentError, type Environment } from '@sportify/validation';
import { parseWorkerConfig, type WorkerConfig } from './env.schema.js';

export function loadWorkerEnv(
  injected: Environment = process.env,
  applicationDirectory = resolve(__dirname, '../..'),
): WorkerConfig {
  const environment = { ...injected };
  if (environment.NODE_ENV === undefined || environment.NODE_ENV === 'development') {
    for (const filename of ['.env.local', '.env']) {
      const result = config({
        path: resolve(applicationDirectory, filename),
        processEnv: environment,
        override: false,
        quiet: true,
      });
      if (result.error && (result.error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new EnvironmentError([
          `${filename}: could not read the application environment file`,
        ]);
      }
    }
  }
  return parseWorkerConfig(environment);
}
