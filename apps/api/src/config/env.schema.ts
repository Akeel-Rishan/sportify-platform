import { nodeEnvSchema, parseEnvironment, type Environment } from '@sportify/validation';
import { z } from 'zod';

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default(4000),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function parseApiEnv(environment: Environment): ApiEnv {
  return parseEnvironment(apiEnvSchema, environment, {
    NODE_ENV: 'expected development, test or production; empty values are invalid',
    PORT: 'expected an integer from 1 to 65535, with no whitespace or suffix; empty values are invalid',
  });
}
