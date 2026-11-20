import { HttpException, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import type { ValidationIssue } from '@sportify/api-contracts';
import { z } from 'zod';

export class DtoValidationError extends HttpException {
  constructor(readonly details: ValidationIssue[]) {
    super('DTO validation failed', 400);
  }
}

export const MAX_VALIDATION_DETAILS = 20;

function safePath(schema: z.ZodType, path: readonly PropertyKey[]): string {
  let current: unknown = schema;
  return (
    path
      .slice(0, 8)
      .map((part) => {
        for (let depth = 0; depth < 16; depth++) {
          if (
            current instanceof z.ZodOptional ||
            current instanceof z.ZodNullable ||
            current instanceof z.ZodDefault ||
            current instanceof z.ZodReadonly
          )
            current = current.unwrap();
          else if (current instanceof z.ZodPipe) current = current.in;
          else break;
        }
        if (
          current instanceof z.ZodObject &&
          typeof part === 'string' &&
          /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(part) &&
          Object.hasOwn(current.shape, part)
        ) {
          const child: unknown = current.shape[part];
          current = child;
          return part;
        }
        if (
          current instanceof z.ZodArray &&
          typeof part === 'number' &&
          Number.isSafeInteger(part) &&
          part >= 0
        ) {
          current = current.element;
          return String(part);
        }
        // Record keys, custom issue paths and unsupported schema constructs are not public field names.
        current = undefined;
        return '*';
      })
      .join('.')
      .slice(0, 160) || '$'
  );
}

export function validationDetails(
  issues: readonly z.core.$ZodIssue[],
  schema: z.ZodType,
): ValidationIssue[] {
  return issues.slice(0, MAX_VALIDATION_DETAILS).map((issue) => {
    // Fixed-schema property names and bounded array indices only; no submitted values/messages.
    const path = safePath(schema, issue.path);
    const unknown = issue.code === 'unrecognized_keys';
    return {
      field: path || '$',
      code: unknown ? 'UNKNOWN_FIELD' : 'INVALID_VALUE',
      message: unknown ? 'Remove fields that are not allowed.' : 'Provide a valid value.',
    };
  });
}

// DTO classes declare `static schema = z.strictObject(...)` (including nested objects).
// Nest supplies their runtime metatype; interfaces have no runtime validation metadata.
export class DtoValidationPipe implements PipeTransform<unknown, unknown> {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const metatype: unknown = metadata.metatype;
    if (typeof metatype !== 'function' || !('schema' in metatype)) return value;
    const schema: unknown = metatype.schema;
    if (!(schema instanceof z.ZodType)) throw new Error('DTO schema must be a Zod schema.');
    const result = schema.safeParse(value);
    if (!result.success)
      throw new DtoValidationError(validationDetails(result.error.issues, schema));
    return result.data;
  }
}
