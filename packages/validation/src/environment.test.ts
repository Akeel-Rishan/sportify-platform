import { expect, it } from 'vitest';
import { z } from 'zod';
import { EnvironmentError, parseEnvironment } from './environment.js';

it('never returns input values from an unknown schema failure', () => {
  expect(() =>
    parseEnvironment(z.object({ FIELD: z.never() }), { FIELD: 'do-not-echo' }, {}),
  ).toThrow(new EnvironmentError(['FIELD: invalid configuration']));
});

it('returns typed parsed data and strips unrelated supplied values', () => {
  expect(
    parseEnvironment(
      z.object({ VALUE: z.string().transform(Number) }),
      { VALUE: '12', PRIVATE: 'not-exposed' },
      {},
    ),
  ).toEqual({ VALUE: 12 });
});

it('deduplicates variable errors and uses only authored explanations', () => {
  expect(() =>
    parseEnvironment(
      z.object({ PORT: z.string().min(4).regex(/^\d+$/) }),
      { PORT: 'x' },
      { PORT: 'decimal digits required' },
    ),
  ).toThrow(new EnvironmentError(['PORT: decimal digits required']));
});
