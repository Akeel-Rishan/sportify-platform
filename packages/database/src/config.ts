import { z } from 'zod';
import { parseEnvironment, type Environment } from '@sportify/validation';
import { isAbsolute } from 'node:path';

export type DatabaseRole = 'api' | 'worker';

const integer = (minimum: number, maximum: number, fallback: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(minimum).max(maximum))
    .default(fallback);

export function databaseSchema(role: DatabaseRole) {
  return z
    .object({
      ORACLE_USER: z.literal(role === 'api' ? 'SPORTIFY_API' : 'SPORTIFY_WORKER'),
      ORACLE_PASSWORD: z.string().min(1).max(1024),
      ORACLE_WALLET_DIRECTORY: z
        .string()
        .min(1)
        .max(4096)
        .refine((value) => isAbsolute(value) && !value.includes('\0')),
      ORACLE_WALLET_PASSWORD: z.string().min(1).max(1024),
      // Deliberately accept only option-free TCPS Easy Connect. No arbitrary
      // descriptors, aliases, retries, embedded wallet options or TLS overrides.
      ORACLE_CONNECT_STRING: z
        .string()
        .regex(
          /^tcps:\/\/[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?:\d{1,5}\/[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
        )
        .refine((value) => {
          const port = Number(value.split(':')[2]?.split('/')[0]);
          return port >= 1 && port <= 65535;
        }),
      ORACLE_SCHEMA_OWNER: z.literal('SPORTIFY_SCHEMA_OWNER').default('SPORTIFY_SCHEMA_OWNER'),
      ORACLE_POOL_MIN: integer(0, role === 'api' ? 8 : 2, 0),
      ORACLE_POOL_MAX: integer(1, role === 'api' ? 8 : 2, role === 'api' ? 8 : 2),
      ORACLE_POOL_INCREMENT: integer(1, role === 'api' ? 8 : 2, 1),
      ORACLE_POOL_IDLE_SECONDS: integer(10, 3600, 60),
      ORACLE_QUEUE_TIMEOUT_MS: integer(100, 5000, 1500),
      ORACLE_CALL_TIMEOUT_MS: integer(100, 5000, 1500),
    })
    .superRefine((value, context) => {
      if (value.ORACLE_POOL_MIN > value.ORACLE_POOL_MAX)
        context.addIssue({
          code: 'custom',
          path: ['ORACLE_POOL_MIN'],
          message: 'invalid pool range',
        });
      if (value.ORACLE_POOL_INCREMENT > value.ORACLE_POOL_MAX)
        context.addIssue({
          code: 'custom',
          path: ['ORACLE_POOL_INCREMENT'],
          message: 'invalid pool increment',
        });
    });
}

export type DatabaseConfig = z.infer<ReturnType<typeof databaseSchema>>;
export function parseDatabaseConfig(environment: Environment, role: DatabaseRole): DatabaseConfig {
  return parseEnvironment(databaseSchema(role), environment, {
    ORACLE_USER: `expected the restricted SPORTIFY_${role.toUpperCase()} identity`,
    ORACLE_PASSWORD: 'a securely supplied nonempty password is required',
    ORACLE_WALLET_DIRECTORY:
      'expected an absolute path to the securely extracted instance wallet outside source control',
    ORACLE_WALLET_PASSWORD: 'a securely supplied nonempty instance-wallet password is required',
    ORACLE_CONNECT_STRING:
      'expected option-free tcps://host:port/service from the designated ATP mTLS connection information',
    ORACLE_SCHEMA_OWNER: 'expected the reviewed SPORTIFY_SCHEMA_OWNER identifier',
    ORACLE_POOL_MIN: 'expected an integer from zero through pool maximum',
    ORACLE_POOL_MAX: `expected an integer from 1 through ${role === 'api' ? 8 : 2}`,
    ORACLE_POOL_INCREMENT: 'expected a positive integer no larger than pool maximum',
    ORACLE_POOL_IDLE_SECONDS: 'expected integer seconds from 10 through 3600',
    ORACLE_QUEUE_TIMEOUT_MS: 'expected integer milliseconds from 100 through 5000',
    ORACLE_CALL_TIMEOUT_MS: 'expected integer milliseconds from 100 through 5000',
  });
}
