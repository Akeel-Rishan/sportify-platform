import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { Request, RequestHandler } from 'express';
import type { RequestLogger } from '../logging/request-logger.js';

const contextKey = Symbol('sportify.request-context');
interface RequestContext {
  readonly requestId: string;
}
export interface ApiRequest extends Request {
  [contextKey]?: RequestContext;
}

export function requestId(request: ApiRequest): string {
  const context = request[contextKey];
  if (!context) throw new Error('HTTP request context was not initialized.');
  return context.requestId;
}

export function matchedRoute(request: Request): string {
  const route: unknown = request.route;
  return typeof route === 'object' &&
    route !== null &&
    'path' in route &&
    typeof route.path === 'string'
    ? route.path
    : 'unmatched';
}

export function requestContext(logger: RequestLogger): RequestHandler {
  return (request: ApiRequest, response, next): void => {
    const id = randomUUID();
    request[contextKey] = Object.freeze({ requestId: id });
    response.setHeader('X-Request-ID', id);
    const started = performance.now();
    let logged = false;
    const complete = (): void => {
      if (logged) return;
      logged = true;
      response.removeListener('finish', complete);
      response.removeListener('close', complete);
      const completed = response.writableFinished;
      const status = completed || response.headersSent ? response.statusCode : null;
      logger.write({
        timestamp: new Date().toISOString(),
        service: 'sportify-api',
        severity:
          !completed || (status !== null && status >= 500)
            ? 'error'
            : status !== null && status >= 400
              ? 'warn'
              : 'info',
        event: 'http.request.completed',
        requestId: id,
        method: /^[A-Z]{1,20}$/.test(request.method) ? request.method : 'OTHER',
        route: matchedRoute(request),
        status,
        durationMs: Math.max(0, performance.now() - started),
        outcome: completed ? 'completed' : 'aborted',
      });
    };
    response.once('finish', complete);
    response.once('close', complete);
    next();
  };
}
