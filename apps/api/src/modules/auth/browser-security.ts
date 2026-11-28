import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response, CookieOptions } from 'express';
import { tokenPattern } from '@sportify/verification-email';
import { ApplicationError } from '../../common/errors/application-error.js';
import type { SessionConfig } from './session-config.js';

export function newSessionSecret(): string {
  return randomBytes(32).toString('base64url');
}

export class BrowserAuth {
  private readonly sessionName: string;
  private readonly csrfName: string;
  private readonly cookieOptions: CookieOptions;

  constructor(private readonly config: SessionConfig) {
    this.sessionName = config.secureCookies ? '__Host-sportify_session' : 'sportify_session_dev';
    this.csrfName = config.secureCookies ? '__Host-sportify_csrf' : 'sportify_csrf_dev';
    this.cookieOptions = {
      httpOnly: true,
      secure: config.secureCookies,
      sameSite: 'lax',
      path: '/',
    };
  }

  checkOrigin(request: Request, requireOrigin: boolean): void {
    const origin = request.get('origin');
    const host = request.get('host')?.toLowerCase();
    const trustedHost = this.config.dashboardOrigin.host;
    const defaultHttpsPort =
      this.config.dashboardOrigin.protocol === 'https:' &&
      this.config.dashboardOrigin.port === '' &&
      host === trustedHost + ':443';
    // Compare Host to configuration. Never use it or forwarding headers to derive trust.
    if (
      (host !== trustedHost && !defaultHttpsPort) ||
      ((origin !== undefined || requireOrigin) && origin !== this.config.dashboardOrigin.origin) ||
      ['same-site', 'cross-site'].includes(request.get('sec-fetch-site') ?? '')
    )
      throw new ApplicationError('FORBIDDEN');
  }

  session(request: Request): string | undefined {
    return this.cookie(request, this.sessionName);
  }

  setSession(response: Response, token: string, expires: Date): void {
    response.cookie(this.sessionName, token, { ...this.cookieOptions, expires });
  }

  clearSession(response: Response): void {
    response.clearCookie(this.sessionName, this.cookieOptions);
    response.clearCookie(this.csrfName, this.cookieOptions);
  }

  bootstrap(request: Request, response: Response): string {
    this.checkOrigin(request, false);
    if (request.get('x-csrf-bootstrap') !== '1') throw new ApplicationError('FORBIDDEN');
    const session = this.session(request);
    const current = this.cookie(request, this.csrfName);
    const nonce = current ?? newSessionSecret();
    if (current === undefined) response.cookie(this.csrfName, nonce, this.cookieOptions);
    return nonce + '.' + this.signature(nonce, session);
  }

  checkMutation(request: Request): string | undefined {
    this.checkOrigin(request, true);
    const session = this.session(request);
    const nonce = this.cookie(request, this.csrfName);
    const supplied = request.get('x-csrf-token');
    if (!nonce || supplied?.length !== 87) throw new ApplicationError('FORBIDDEN');
    const expected = nonce + '.' + this.signature(nonce, session);
    const candidate = Buffer.from(supplied, 'utf8');
    const canonical = Buffer.from(expected, 'ascii');
    if (candidate.length !== canonical.length || !timingSafeEqual(candidate, canonical))
      throw new ApplicationError('FORBIDDEN');
    return session;
  }

  private cookie(request: Request, name: string): string | undefined {
    let found = false;
    let value: string | undefined;
    for (const entry of (request.headers.cookie ?? '').split(';')) {
      const equals = entry.indexOf('=');
      if (equals < 0 || entry.slice(0, equals).trim() !== name) continue;
      if (found) throw new ApplicationError('BAD_REQUEST');
      found = true;
      value = entry.slice(equals + 1);
    }
    return value?.length === 43 && tokenPattern.test(value) ? value : undefined;
  }

  private signature(nonce: string, session: string | undefined): string {
    return createHmac('sha256', this.config.csrfKey)
      .update(
        JSON.stringify([
          'sportify.dashboard.csrf.v1',
          this.config.dashboardOrigin.origin,
          nonce,
          session ?? null,
        ]),
      )
      .digest('base64url');
  }
}
