import { afterEach, expect, it } from 'vitest';
import type { ApiResponse, HealthResponse, ReadinessResponse } from '@sportify/api-contracts';
import { httpFixture } from './support/http-fixture.js';
import { ReadinessService } from '../src/modules/health/readiness.service.js';

let fixture: Awaited<ReturnType<typeof httpFixture>> | undefined;
afterEach(async () => {
  await fixture?.app.close();
  fixture = undefined;
});

it('reports safe liveness and initialized application-only readiness with no-store', async () => {
  fixture = await httpFixture();
  for (const [path, expected] of [
    ['health', { status: 'ok', service: 'sportify-api' }],
    ['ready', { status: 'ready', scope: 'application' }],
  ] as const) {
    const response = await fetch(`${fixture.url}/api/v1/${path}`);
    const body = (await response.json()) as ApiResponse<HealthResponse | ReadinessResponse>;
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({
      success: true,
      data: expected,
      requestId: response.headers.get('x-request-id'),
    });
    expect(body.requestId).toMatch(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/);
  }
  expect((await fetch(`${fixture.url}/health`)).status).toBe(404);
  expect((await fetch(`${fixture.url}/api/v1/api/v1/health`)).status).toBe(404);
});

it('returns a safe 503 for injected unavailable readiness while liveness remains 200', async () => {
  class Unavailable extends ReadinessService {
    override isReady() {
      return false;
    }
  }
  fixture = await httpFixture(new Unavailable());
  const response = await fetch(`${fixture.url}/api/v1/ready`);
  const body = (await response.json()) as ApiResponse<never>;
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(body).toEqual({
    success: false,
    error: { code: 'SERVICE_UNAVAILABLE', message: 'The service is temporarily unavailable.' },
    requestId: response.headers.get('x-request-id'),
  });
  expect((await fetch(`${fixture.url}/api/v1/health`)).status).toBe(200);
});

it('marks readiness unavailable before bootstrap and after module destruction', async () => {
  const state = new ReadinessService();
  expect(state.isReady()).toBe(false);
  fixture = await httpFixture(state);
  expect(state.isReady()).toBe(true);
  await fixture.app.close();
  fixture = undefined;
  expect(state.isReady()).toBe(false);
});
