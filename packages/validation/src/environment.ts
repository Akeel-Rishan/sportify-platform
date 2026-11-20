import { z } from 'zod';

export type Environment = Readonly<Record<string, string | undefined>>;

export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

export class EnvironmentError extends Error {
  constructor(fields: string[]) {
    super(`Invalid environment: ${fields.join('; ')}`);
    this.name = 'EnvironmentError';
  }
}

// Explanations come from authored schemas, never from supplied values or Zod's
// serialized input. Unknown process variables are deliberately not exposed.
export function parseEnvironment<T>(
  schema: z.ZodType<T>,
  environment: Environment,
  explanations: Readonly<Record<string, string>>,
): T {
  const result = schema.safeParse(environment);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new EnvironmentError(
      fields.map((field) => `${field}: ${explanations[field] ?? 'invalid configuration'}`),
    );
  }
  return result.data;
}
