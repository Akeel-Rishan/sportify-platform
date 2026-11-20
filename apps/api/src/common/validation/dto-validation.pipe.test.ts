import { expect, it } from 'vitest';
import { z } from 'zod';
import {
  DtoValidationError,
  DtoValidationPipe,
  MAX_VALIDATION_DETAILS,
  validationDetails,
} from './dto-validation.pipe.js';

it('caps details and never forwards submitted values, custom messages or unknown keys', () => {
  const input = Array.from({ length: 60 }, () => ({ value: 'secret' }));
  const schema = z.array(z.strictObject({ value: z.number() }));
  const parsed = schema.safeParse(input);
  expect(parsed.success).toBe(false);
  if (parsed.success) throw new Error('Expected validation errors');
  const details = validationDetails(parsed.error.issues, schema);
  expect(details).toHaveLength(MAX_VALIDATION_DETAILS);
  expect(details[0]?.field).toBe('0.value');
  expect(JSON.stringify(details)).not.toContain('secret');
});

it('bounds/sanitizes paths and ignores arbitrary custom validator text', () => {
  const schema = z.unknown().superRefine((_, ctx) =>
    ctx.addIssue({
      code: 'custom',
      message: 'PRIVATE_CUSTOM_MESSAGE',
      path: ['invalid/key', 'PRIVATE_KEY', ...Array.from({ length: 12 }, () => 'field')],
    }),
  );
  const parsed = schema.safeParse('PRIVATE_VALUE');
  if (parsed.success) throw new Error('Expected validation errors');
  const details = validationDetails(parsed.error.issues, schema);
  expect(details[0]?.field.split('.')).toHaveLength(8);
  expect(details[0]?.field).toMatch(/^\*\./);
  expect(JSON.stringify(details)).not.toContain('PRIVATE');
});

it('leaves non-DTO arguments unchanged and rejects a misconfigured DTO schema', () => {
  const pipe = new DtoValidationPipe();
  expect(pipe.transform('false', { type: 'query', metatype: String })).toBe('false');
  expect(pipe.transform(undefined, { type: 'custom' })).toBeUndefined();
  class InvalidDto {
    static schema = {};
  }
  expect(() => pipe.transform({}, { type: 'body', metatype: InvalidDto })).toThrow('DTO schema');
});

it('keeps known nested array fields while redacting arbitrary client record keys', () => {
  const schema = z.strictObject({
    items: z.array(z.strictObject({ count: z.number() })).optional(),
    dictionary: z.record(z.string(), z.number()),
  });
  const parsed = schema.safeParse({
    items: [{ count: 'PRIVATE_VALUE' }],
    dictionary: { PRIVATE_KEY: 'PRIVATE_VALUE' },
  });
  if (parsed.success) throw new Error('Expected validation errors');
  const details = validationDetails(parsed.error.issues, schema);
  expect(details.map((detail) => detail.field)).toEqual(['items.0.count', 'dictionary.*']);
  expect(JSON.stringify(details)).not.toContain('PRIVATE');
});

it('validates only explicit conversions and rejects strings for booleans', () => {
  const pipe = new DtoValidationPipe();
  class Dto {
    static schema = z.strictObject({
      page: z.string().regex(/^\d+$/).transform(Number),
      flag: z.boolean(),
    });
  }
  expect(pipe.transform({ page: '2', flag: false }, { type: 'body', metatype: Dto })).toEqual({
    page: 2,
    flag: false,
  });
  expect(() =>
    pipe.transform({ page: '2', flag: 'false' }, { type: 'body', metatype: Dto }),
  ).toThrow(DtoValidationError);
});
