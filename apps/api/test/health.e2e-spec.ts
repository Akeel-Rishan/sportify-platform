import { afterEach, expect, it } from 'vitest';
import type { ApiResponse, HealthResponse, ReadinessResponse } from '@sportify/api-contracts';
import { httpFixture } from './support/http-fixture.js';
import { ReadinessService } from '../src/modules/health/readiness.service.js';
import { vi } from 'vitest';

let fixture: Awaited<ReturnType<typeof httpFixture>> | undefined;
afterEach(async () => {
  await fixture?.app.close();
  fixture = undefined;
});

it('reports safe liveness and initialized application-and-Oracle readiness with no-store', async () => {
  fixture = await httpFixture();
  for (const [path, expected] of [
    ['health', { status: 'ok', service: 'sportify-api' }],
    ['ready', { status: 'ready', scope: 'application-and-oracle' }],
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
      return Promise.resolve(false);
    }
  }
  fixture = await httpFixture(
    new Unavailable({ check: () => Promise.resolve(false), stopAccepting: () => {} }),
  );
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
  const state = new ReadinessService({
    check: () => Promise.resolve(true),
    stopAccepting: () => {},
  });
  expect(await state.isReady()).toBe(false);
  fixture = await httpFixture(state);
  expect(await state.isReady()).toBe(true);
  await fixture.app.close();
  fixture = undefined;
  expect(await state.isReady()).toBe(false);
});

it('observes injected dependency outage and recovery over real HTTP without affecting liveness', async () => {
  let now = 0;
  const dependency = { check: vi.fn().mockResolvedValue(true), stopAccepting: vi.fn() };
  fixture = await httpFixture(new ReadinessService(dependency, () => now));
  expect((await fetch(`${fixture.url}/api/v1/ready`)).status).toBe(200);
  dependency.check.mockRejectedValueOnce(new Error('PRIVATE_ORACLE_PASSWORD_ENDPOINT_SENTINEL'));
  now = 1000;
  const response = await fetch(`${fixture.url}/api/v1/ready`);
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.text()).not.toContain('PRIVATE_ORACLE');
  expect((await fetch(`${fixture.url}/api/v1/health`)).status).toBe(200);
  now = 2000;
  expect((await fetch(`${fixture.url}/api/v1/ready`)).status).toBe(200);
  expect(JSON.stringify(fixture.records)).not.toContain('PRIVATE_ORACLE');
});
