import { afterAll, beforeAll, expect, it } from 'vitest';
import type { ApiResponse } from '@sportify/api-contracts';
import { httpFixture, SENTINEL } from './support/http-fixture.js';
import { get } from 'node:http';

let fixture: Awaited<ReturnType<typeof httpFixture>>;
beforeAll(async () => {
  fixture = await httpFixture();
});
afterAll(async () => {
  await fixture?.app.close();
});

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${fixture.url}/api/v1/${path}`, init);
  const body = (await response.json()) as ApiResponse<unknown>;
  expect(body.requestId).toBe(response.headers.get('x-request-id'));
  return { response, body };
}

it('wraps data exactly once without guessing from data property names; undefined is null', async () => {
  const { body } = await request('proof/data');
  expect(body).toEqual({
    success: true,
    data: { success: true, data: 'payload', requestId: 'payload-value' },
    requestId: body.requestId,
  });
  const nothing = await request('proof/undefined');
  expect(nothing.body).toEqual({ success: true, data: null, requestId: nothing.body.requestId });
});

it('validates a DTO with runtime metadata and preserves POST 201 and boolean false', async () => {
  const payload = { label: 'test', enabled: false, nested: { count: 2 } };
  const { response, body } = await request('proof/dto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  expect(response.status).toBe(201);
  expect(body).toEqual({ success: true, data: payload, requestId: body.requestId });
});

it.each(['proof/no-content', 'proof/not-modified'])('sends no body for %s', async (path) => {
  const response = await fetch(`${fixture.url}/api/v1/${path}`);
  expect(response.status).toBe(path.includes('no-content') ? 204 : 304);
  expect(await response.text()).toBe('');
  expect(response.headers.get('content-type')).toBeNull();
  expect(response.headers.get('x-request-id')).toBeTruthy();
});

it.each(['health', 'proof/unexpected'])('sends no HEAD body for %s', async (path) => {
  const response = await fetch(`${fixture.url}/api/v1/${path}`, { method: 'HEAD' });
  expect(response.status).toBe(path === 'health' ? 200 : 500);
  expect(await response.text()).toBe('');
  expect(response.headers.get('x-request-id')).toBeTruthy();
});

it('preserves redirect, StreamableFile and explicit raw-response semantics', async () => {
  const redirect = await fetch(`${fixture.url}/api/v1/proof/redirect`, { redirect: 'manual' });
  expect(redirect.status).toBe(302);
  expect(redirect.headers.get('location')).toBe('/api/v1/health');
  for (const [path, text] of [
    ['file', 'test-only-file'],
    ['raw', 'test-only-raw'],
  ]) {
    const response = await fetch(`${fixture.url}/api/v1/proof/${path}`);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toBe(text);
  }
});

it('does not write another response after headers/body were sent', async () => {
  const response = await fetch(`${fixture.url}/api/v1/proof/sent`);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('already-sent');
  const id = response.headers.get('x-request-id');
  expect(
    fixture.records.filter((r) => r.requestId === id && r.event === 'http.request.error'),
  ).toHaveLength(1);
  expect(JSON.stringify(fixture.records)).not.toContain(SENTINEL);
});

it('logs one aborted completion when a client disconnects from an unfinished response', async () => {
  const id = await new Promise<string>((resolve, reject) => {
    const client = get(`${fixture.url}/api/v1/proof/aborted`, (response) => {
      const id = response.headers['x-request-id'];
      response.destroy();
      if (typeof id === 'string') resolve(id);
      else reject(new Error('Missing request ID'));
    });
    client.once('error', reject);
  });
  const record = await fixture.completion(id);
  expect(record).toMatchObject({ outcome: 'aborted', route: '/api/v1/proof/aborted', status: 200 });
  expect(fixture.records.filter((r) => r.requestId === id)).toHaveLength(1);
});

it('normalizes unknown routes and does not trust incoming correlation', async () => {
  const { response, body } = await request(`unknown/${SENTINEL}?q=${SENTINEL}`, {
    headers: {
      'X-Request-ID': SENTINEL,
      Authorization: `Bearer ${SENTINEL}`,
      Cookie: `token=${SENTINEL}`,
    },
  });
  expect(response.status).toBe(404);
  expect(body.success).toBe(false);
  if (!body.success) expect(body.error.code).toBe('NOT_FOUND');
  expect(body.requestId).not.toBe(SENTINEL);
  const log = fixture.records.filter((record) => record.requestId === body.requestId);
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject({
    event: 'http.request.completed',
    route: 'unmatched',
    status: 404,
    outcome: 'completed',
  });
  expect(JSON.stringify(log)).not.toContain(SENTINEL);
});

it.each([
  [{ label: SENTINEL, enabled: 'false', nested: { count: '2' } }, ['enabled', 'nested.count']],
  [{ label: '', enabled: false, nested: { count: 0 } }, ['label', 'nested.count']],
  [{ label: 'ok', enabled: false, nested: { count: 1 }, [SENTINEL]: SENTINEL }, ['$']],
  [{ label: 'ok', enabled: false, nested: { count: 1, [SENTINEL]: SENTINEL } }, ['nested']],
])(
  'rejects invalid/unknown/nested fields without input or target disclosure',
  async (payload, fields) => {
    const { response, body } = await request('proof/dto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    if (body.success) throw new Error('Expected failure');
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details?.map((detail) => detail.field)).toEqual(fields);
    expect(JSON.stringify(body)).not.toContain(SENTINEL);
  },
);

it.each([
  [`{\"secret\":\"${SENTINEL}\",`, 400, 'BAD_REQUEST'],
  [JSON.stringify({ secret: SENTINEL, padding: 'x'.repeat(110 * 1024) }), 413, 'PAYLOAD_TOO_LARGE'],
] as const)('correlates early parser failures safely', async (input, status, code) => {
  const { response, body } = await request('proof/dto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Request-ID': SENTINEL },
    body: input,
  });
  expect(response.status).toBe(status);
  expect(body.success).toBe(false);
  if (!body.success) expect(body.error.code).toBe(code);
  expect(JSON.stringify(body)).not.toContain(SENTINEL);
  expect(fixture.records.filter((record) => record.requestId === body.requestId)).toEqual([
    expect.objectContaining({ event: 'http.request.completed', status, route: 'unmatched' }),
  ]);
});

it.each([
  [400, 'BAD_REQUEST'],
  [401, 'UNAUTHENTICATED'],
  [403, 'FORBIDDEN'],
  [404, 'NOT_FOUND'],
  [405, 'METHOD_NOT_ALLOWED'],
  [409, 'CONFLICT'],
  [413, 'PAYLOAD_TOO_LARGE'],
  [415, 'UNSUPPORTED_MEDIA_TYPE'],
  [422, 'BUSINESS_RULE_VIOLATION'],
  [429, 'RATE_LIMITED'],
  [500, 'INTERNAL_ERROR'],
  [503, 'SERVICE_UNAVAILABLE'],
  [418, 'BAD_REQUEST'],
  [502, 'INTERNAL_ERROR'],
])('normalizes explicit framework status %s with safe code %s', async (status, code) => {
  const { response, body } = await request(`proof/framework/${status}`);
  expect(response.status).toBe(status);
  expect(body.success).toBe(false);
  if (!body.success) expect(body.error.code).toBe(code);
  expect(JSON.stringify(body)).not.toContain(SENTINEL);
});

it('uses approved application errors and preserves required protocol headers', async () => {
  const conflict = await request('proof/conflict');
  expect(conflict.response.status).toBe(409);
  expect(conflict.body).toMatchObject({ success: false, error: { code: 'CONFLICT' } });
  const challenge = await request('proof/challenge');
  expect(challenge.response.headers.get('www-authenticate')).toBe('Bearer');
  const retry = await request('proof/retry');
  expect(retry.response.headers.get('retry-after')).toBe('30');
  expect(retry.response.headers.get('vary')).toBe('Accept');
  const method = await request('proof/method');
  expect(method.response.headers.get('allow')).toBe('GET');
});

it('returns a generic 500 and correlates safe error and single completion records', async () => {
  const { response, body } = await request(`proof/unexpected?password=${SENTINEL}`);
  expect(response.status).toBe(500);
  expect(body).toEqual({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    requestId: body.requestId,
  });
  const logs = fixture.records.filter((record) => record.requestId === body.requestId);
  expect(logs).toHaveLength(2);
  expect(logs).toEqual([
    expect.objectContaining({
      event: 'http.request.error',
      classification: 'unexpected_exception',
    }),
    expect.objectContaining({
      event: 'http.request.completed',
      route: '/api/v1/proof/unexpected',
      status: 500,
    }),
  ]);
  expect(JSON.stringify([body, ...fixture.records])).not.toContain(SENTINEL);
});

it('isolates concurrent request contexts and logs templates without raw parameters or queries', async () => {
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, index) => request(`proof/parallel/${index}?secret=${SENTINEL}`)),
  );
  const ids = results.map(({ body }) => body.requestId);
  expect(new Set(ids).size).toBe(12);
  for (const id of ids) {
    const logs = fixture.records.filter((record) => record.requestId === id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      route: '/api/v1/proof/parallel/:value',
      method: 'GET',
      status: 200,
      outcome: 'completed',
      service: 'sportify-api',
      severity: 'info',
    });
    if (logs[0]?.event === 'http.request.completed')
      expect(logs[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(logs)).not.toContain(SENTINEL);
  }
});
