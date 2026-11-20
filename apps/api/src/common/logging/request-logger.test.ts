import { expect, it } from 'vitest';
import { RequestLogger, type RequestLogRecord } from './request-logger.js';
import { ApplicationError } from '../errors/application-error.js';

it('captures only an allowlisted error classification and request ID', () => {
  const records: RequestLogRecord[] = [];
  const logger = new RequestLogger((r) => {
    records.push(r);
  });
  logger.error('id', 'unexpected_exception');
  expect(records).toEqual([
    expect.objectContaining({
      event: 'http.request.error',
      requestId: 'id',
      classification: 'unexpected_exception',
    }),
  ]);
  expect(Object.keys(records[0] ?? {}).sort()).toEqual(
    ['timestamp', 'severity', 'service', 'event', 'requestId', 'classification'].sort(),
  );
});

it('isolates failing log sinks without fallback dumping errors', () => {
  const logger = new RequestLogger(() => {
    throw new Error('PRIVATE_SINK_VALUE');
  });
  expect(() => logger.error('id', 'unexpected_exception')).not.toThrow();
});

it('limits application-error protocol headers to safe bounded values', () => {
  const error = new ApplicationError('UNAUTHENTICATED', {
    'WWW-Authenticate': 'Bearer',
    'Retry-After': 'invalid\r\nHeader: injected',
    Allow: 'x'.repeat(300),
  });
  expect(error.protocolHeaders).toEqual({ 'WWW-Authenticate': 'Bearer' });
});
