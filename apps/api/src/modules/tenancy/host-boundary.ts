import type { IncomingMessage } from 'node:http';
import type { Request, RequestHandler } from 'express';
import { ApplicationError } from '../../common/errors/application-error.js';

const platform = 'sportify.lk';
const dashboard = 'app.sportify.lk';
const platformAdmin = 'admin.sportify.lk';
const tenantSuffix = '.' + platform;
const reserved = new Set(['app', 'admin', 'api', 'dashboard', 'www']);
const label = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export const publicIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface HostPolicy {
  readonly environment: 'production' | 'development' | 'test';
  readonly port: number;
  readonly localDashboard?: URL | undefined;
}

export type HostSurface =
  | { readonly surface: 'platform' | 'dashboard' | 'admin' | 'probe' }
  | { readonly surface: 'tenant-website'; readonly slug: string };
type RequestSurface = HostSurface & {
  readonly tenantCandidate?: string | undefined;
  readonly namespace?: 'website' | 'tenant' | undefined;
};
const surfaces = new WeakMap<Request, RequestSurface>();
const tenantPrefix = '/api/v1/tenants';
const websitePrefix = '/api/v1/public/website';
const selectionKeys = new Set([
  'tenant',
  'tenantid',
  'tenantpublicid',
  'tenantslug',
  'xtenant',
  'xtenantid',
  'xtenantpublicid',
  'xtenantslug',
]);

function invalid(): never {
  throw new ApplicationError('BAD_REQUEST');
}

function notFound(): never {
  throw new ApplicationError('NOT_FOUND');
}

function isLocalPeer(peer: string | undefined): boolean {
  return peer === '::1' || peer === '127.0.0.1' || peer === '::ffff:127.0.0.1';
}

export function classifyAuthority(
  headers: IncomingMessage['rawHeaders'],
  policy: HostPolicy,
  peer?: string,
): HostSurface {
  if (headers.length > 4000 || headers.length % 2 !== 0) invalid();
  let authority: string | undefined;
  for (let index = 0; index < headers.length; index += 2) {
    const name = headers[index]?.toLowerCase();
    if (name === 'host') {
      if (authority !== undefined) invalid();
      authority = headers[index + 1];
    }
    if (name === ':authority') invalid();
  }
  // ASCII only. The final label must be complete, with no trailing DNS dot.
  const parsed = /^([A-Za-z0-9.-]{1,253}|\[::1\])(?::([1-9][0-9]{0,4}))?$/.exec(authority ?? '');
  if (!parsed?.[1] || parsed[0] !== authority) invalid();
  const host = parsed[1].toLowerCase();
  const rawPort = parsed[2];
  const port = rawPort === undefined ? undefined : Number(rawPort);
  if (port !== undefined && port > 65535) invalid();

  if (policy.environment !== 'production' && isLocalPeer(peer)) {
    const localHost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    const testAlias =
      policy.environment === 'test' &&
      host.endsWith('.test') &&
      host.split('.').every((part) => label.test(part));
    if (
      (localHost || testAlias) &&
      host + (rawPort === undefined ? '' : ':' + rawPort) === policy.localDashboard?.host
    )
      return { surface: 'dashboard' };
    if (localHost && (port === undefined || port === policy.port || policy.environment === 'test'))
      return { surface: 'probe' };
  }
  if (port !== undefined && port !== 443) invalid();
  if (host === platform) return { surface: 'platform' };
  if (host === dashboard) return { surface: 'dashboard' };
  if (host === platformAdmin) return { surface: 'admin' };
  if (!host.endsWith(tenantSuffix)) invalid();
  const slug = host.slice(0, -tenantSuffix.length);
  if (!label.test(slug) || slug.startsWith('xn--') || reserved.has(slug)) invalid();
  return { surface: 'tenant-website', slug };
}

function inNamespace(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + '/');
}

function selectorKey(key: string): boolean {
  return selectionKeys.has(key.toLowerCase().replace(/[-_]/g, ''));
}

export function rejectOtherTenantSelectors(request: Request): void {
  const query = new URLSearchParams(request.originalUrl.split('?').slice(1).join('?'));
  for (const key of query.keys()) if (selectorKey(key)) invalid();
  const body: unknown = request.body;
  if (typeof body === 'object' && body !== null && Object.keys(body).some(selectorKey)) invalid();
}

export function requestSurface(request: Request): RequestSurface {
  return surfaces.get(request) ?? notFound();
}

export function hostBoundary(policy: HostPolicy): RequestHandler {
  return (request, response, next) => {
    try {
      const path = (request.originalUrl.split('?', 1)[0] ?? '').toLowerCase();
      if (!path.startsWith('/') || /[\\%]|\/\/|(?:^|\/)\.{1,2}(?:\/|$)/.test(path)) invalid();
      const host = classifyAuthority(request.rawHeaders, policy, request.socket.remoteAddress);
      for (let index = 0; index < request.rawHeaders.length; index += 2) {
        const name = request.rawHeaders[index];
        if (name && selectorKey(name)) invalid();
      }

      const probe = /^\/api\/v1\/(?:health|ready)\/?$/.test(path);
      const website = inNamespace(path, websitePrefix);
      const privateTenant = inNamespace(path, tenantPrefix);
      const auth = inNamespace(path, '/api/v1/auth');
      // Local harnesses for registration use the loopback listener directly.
      const localRegistration =
        host.surface === 'probe' &&
        auth &&
        policy.environment !== 'production' &&
        /^\/api\/v1\/auth\/(?:register|verify-email|verification\/resend)\/?$/.test(path);
      if (probe) {
        if (!['GET', 'HEAD'].includes(request.method)) notFound();
        if (!['probe', 'dashboard', 'platform'].includes(host.surface)) notFound();
      } else if (host.surface === 'tenant-website') {
        if (!website || !['GET', 'HEAD'].includes(request.method)) notFound();
      } else if (website || (host.surface !== 'dashboard' && !localRegistration)) {
        if (auth) throw new ApplicationError('FORBIDDEN');
        notFound();
      }
      if (privateTenant || website) {
        response.setHeader('Cache-Control', 'no-store');
      }
      const tenantCandidate =
        privateTenant && host.surface === 'dashboard'
          ? request.originalUrl.split('?', 1)[0]?.split('/')[4]
          : undefined;
      surfaces.set(
        request,
        Object.freeze({
          ...host,
          tenantCandidate,
          namespace: website ? 'website' : privateTenant ? 'tenant' : undefined,
        }),
      );
      next();
    } catch (error) {
      next(error);
    }
  };
}
