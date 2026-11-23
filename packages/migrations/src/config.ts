import { z } from 'zod';
import { isAbsolute } from 'node:path';
import { parseEnvironment, type Environment } from '@sportify/validation';

const schema = z
  .strictObject({
    ORACLE_MIGRATION_CONFIRM: z.literal('designated-development'),
    ORACLE_MIGRATION_DB_UNIQUE_NAME: z.string().regex(/^[A-Za-z0-9_$#.-]{1,128}$/),
    ORACLE_MIGRATION_SCHEMA: z.enum([
      'SPORTIFY_SCHEMA_OWNER',
      'SPORTIFY_TEST_OWNER',
      'SPORTIFY_STEP08_TEST_OWNER',
    ]),
    ORACLE_MIGRATION_USER: z.enum([
      'SPORTIFY_SCHEMA_OWNER',
      'SPORTIFY_TEST_OWNER',
      'SPORTIFY_STEP08_TEST_OWNER',
    ]),
    ORACLE_MIGRATION_PASSWORD: z.string().min(1).max(1024),
    ORACLE_CONNECT_STRING: z
      .string()
      .max(1024)
      .regex(
        /^tcps:\/\/[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?:\d{1,5}\/[A-Za-z0-9][A-Za-z0-9_.-]*$/,
      )
      .refine((value) => {
        const port = Number(value.split(':')[2]?.split('/')[0]);
        return port >= 1 && port <= 65535;
      }),
    ORACLE_WALLET_DIRECTORY: z
      .string()
      .min(1)
      .max(4096)
      .refine((value) => isAbsolute(value) && !value.includes('\0')),
    ORACLE_WALLET_PASSWORD: z.string().min(1).max(1024),
  })
  .superRefine((value, context) => {
    if (value.ORACLE_MIGRATION_USER !== value.ORACLE_MIGRATION_SCHEMA)
      context.addIssue({
        code: 'custom',
        path: ['ORACLE_MIGRATION_USER'],
        message: 'owner mismatch',
      });
  });
export type MigrationConfig = z.infer<typeof schema>;
export function parseMigrationConfig(environment: Environment): MigrationConfig {
  const input = Object.fromEntries(Object.keys(schema.shape).map((key) => [key, environment[key]]));
  return parseEnvironment(schema, input, {
    ORACLE_MIGRATION_CONFIRM: 'explicit designated-development target confirmation required',
    ORACLE_MIGRATION_DB_UNIQUE_NAME: 'explicit expected development database unique name required',
    ORACLE_MIGRATION_SCHEMA:
      'expected application owner or explicitly isolated SPORTIFY_TEST_OWNER / SPORTIFY_STEP08_TEST_OWNER',
    ORACLE_MIGRATION_USER: 'must be the exact selected owner schema, never ADMIN/API/worker',
    ORACLE_MIGRATION_PASSWORD: 'securely injected nonempty migration-only password required',
    ORACLE_CONNECT_STRING: 'expected option-free TCPS host:port/service from the designated target',
    ORACLE_WALLET_DIRECTORY: 'absolute protected instance-wallet directory required',
    ORACLE_WALLET_PASSWORD: 'securely injected instance-wallet password required',
  });
}
