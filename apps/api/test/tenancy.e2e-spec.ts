import 'reflect-metadata';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer, request as upstreamRequest } from 'node:http';
import { createConnection } from 'node:net';
import { Controller, Get, Inject, Module, Post, Req, UseGuards } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Database, SqlBinds, SqlConnection } from '@sportify/database';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../src/bootstrap/configure-app.js';
import { ApplicationError } from '../src/common/errors/application-error.js';
import type { RequestLogRecord } from '../src/common/logging/request-logger.js';
import type { ApiRequest } from '../src/common/middleware/request-context.js';
import { AccountService } from '../src/modules/auth/account.service.js';
import { BrowserAuth, newSessionSecret } from '../src/modules/auth/browser-security.js';
import { parseSessionConfig } from '../src/modules/auth/session-config.js';
import { TenantRepositories } from '../src/modules/tenancy/tenant-repositories.js';
import {
  memberScope,
  TenantMemberGuard,
  TenantModule,
  WebsiteTenantGuard,
  websiteScope,
} from '../src/modules/tenancy/tenant.module.js';
import { fakeDatabase } from './support/database.js';

const owner = 'SPORTIFY_SCHEMA_OWNER' as const;
const dashboard = 'app.sportify.lk';
const site = 'venue-one.sportify.lk';
const tenantA = randomUUID();
const tenantB = randomUUID();
const account = randomUUID();
const session = newSessionSecret();
const adminSession = newSessionSecret();
const key = () => randomBytes(32).toString('base64url');
const config = parseSessionConfig(
  {
    AUTH_ACCOUNT_ENABLED: 'true',
    AUTH_DASHBOARD_ORIGIN: 'https://' + dashboard,
    AUTH_CSRF_KEY: key(),
    AUTH_SOURCE_KEY: key(),
    AUTH_RESET_KEYS: JSON.stringify({ r1: key() }),
    AUTH_RESET_KEY_VERSION: 'r1',
    AUTH_PASSWORD_BLOCKLIST_PATH: process.cwd() + '/unused-test-corpus.txt',
    AUTH_RESET_OUTBOX_MAX_ATTEMPTS: '2',
    AUTH_LOGIN_PAIR_LIMIT: '5',
    AUTH_SESSION_SOURCE_LIMIT: '80',
  },
  'test',
)!;

@Controller('public/website')
@UseGuards(WebsiteTenantGuard)
class WebsiteTestController {
  constructor(@Inject(TenantRepositories) private readonly repos: TenantRepositories) {}

  @Get()
  show(@Req() request: ApiRequest) {
    const scope = websiteScope(request);
    expect(() => this.repos.resources(scope as never)).toThrow(ApplicationError);
    return this.repos.website(scope);
  }
}

@Controller('tenants/:tenantPublicId')
@UseGuards(TenantMemberGuard)
class WorkspaceTestController {
  constructor(@Inject(TenantRepositories) private readonly repos: TenantRepositories) {}

  @Get('totals')
  totals(@Req() request: ApiRequest) {
    return this.repos.resources(memberScope(request)).totals();
  }

  @Post('totals')
  mutation(@Req() request: ApiRequest) {
    return this.repos.resources(memberScope(request)).totals();
  }

  @Get('resources')
  forbiddenWrite(@Req() request: ApiRequest) {
    return this.repos.transaction(memberScope(request), () => Promise.resolve());
  }

  @Post('resources')
  write(@Req() request: ApiRequest) {
    const first = tenantA;
    const second = tenantB;
    return this.repos.transaction(memberScope(request), async (resources) => ({
      inserted: await resources.insert({
        locationPublicId: first,
        sportCode: 'TEST',
        code: 'TEST-1',
        name: 'Fixture',
        type: 'COURT',
      }),
      found: await resources.find(first),
      list: await resources.list(),
      renamed: await resources.rename(first, 'Updated'),
      deleted: await resources.remove(second),
      mixed: await resources.deactivate([first, second]),
    }));
  }
}

@Module({})
class TestAccountModule {}
@Module({})
class TenantHttpTestModule {}

@Controller('tenants/:tenantPublicId/unguarded')
class UnguardedTestController {
  @Get()
  show() {
    return { accidental: 'disclosure' };
  }
}

describe('tenant HTTP boundary', () => {
  const log: RequestLogRecord[] = [];
  const query = vi.fn<(sql: string, binds?: SqlBinds) => Promise<{ rows: unknown[] }>>();
  const transaction = vi.fn<Database['transaction']>();
  const db: Database = {
    ...fakeDatabase(),
    query: query as Database['query'],
    transaction: transaction as Database['transaction'],
  };
  const allowed = new Map<string, string>([
    [tenantA, '41'],
    [tenantB, '52'],
  ]);
  let published = true;
  let url: URL;
  let app: NestExpressApplication;
  const statements: { sql: string; binds: SqlBinds | undefined }[] = [];

  beforeAll(async () => {
    query.mockImplementation((sql, binds) => {
      function result(row: unknown) {
        return Promise.resolve({ rows: row ? [row] : [] });
      }
      if (sql.includes('m.MEMBERSHIP_ID') && binds?.accountPublicId === account) {
        const candidate = String(binds.tenantPublicId);
        const id = allowed.get(candidate);
        return result(
          id ? { TENANT_ID: id, TENANT_PUBLIC_ID: candidate, MEMBERSHIP_ID: id } : null,
        );
      }
      if (sql.includes('w.SUBDOMAIN_SLUG') && binds?.slug === 'venue-one' && published) {
        return result(
          binds.tenantId
            ? { BUSINESS_NAME: 'Fixture business', PAGE_TITLE: 'Fixture homepage' }
            : { TENANT_ID: '41', TENANT_PUBLIC_ID: tenantA, BUSINESS_ID: '2', WEBSITE_ID: '3' },
        );
      }
      if (sql.includes('SUM(r.CAPACITY)') && binds?.tenantId) {
        return result({ RESOURCE_COUNT: '1', TOTAL_CAPACITY: binds?.tenantId });
      }
      return result(null);
    });
    const result = { rows: [], rowsAffected: 0 };
    const connection: SqlConnection = {
      execute: (sql, binds) => {
        statements.push({ sql, binds });
        return Promise.resolve(result);
      },
    };
    transaction.mockImplementation((work) => work(connection));
    app = await NestFactory.create<NestExpressApplication>(
      {
        module: TenantHttpTestModule,
        imports: [
          TenantModule.register(db, owner, {
            module: TestAccountModule,
            providers: [
              { provide: BrowserAuth, useValue: new BrowserAuth(config) },
              {
                provide: AccountService,
                useValue: {
                  me: async (token: string | undefined) => {
                    if (token !== session) throw new ApplicationError('UNAUTHENTICATED');
                    return Promise.resolve({
                      publicId: account,
                      fullName: 'Fixture',
                      emailVerified: true,
                    });
                  },
                },
              },
            ],
            exports: [BrowserAuth, AccountService],
          }),
        ],
        controllers: [WebsiteTestController, WorkspaceTestController, UnguardedTestController],
      },
      { logger: false, abortOnError: false },
    );
    configureApp(app, (entry) => log.push(entry), { environment: 'production', port: 4000 });
    await app.listen(0, '127.0.0.1');
    url = new URL(await app.getUrl());
  });

  afterAll(async () => app?.close());

  const workspace = (tenant: string = tenantA) => '/api/v1/tenants/' + tenant + '/totals';
  const website = '/api/v1/public/website';
  const dashboardCookie = (token = session) => '__Host-sportify_session=' + token;

  function wire(preamble: string, headers: string[], body = '') {
    return new Promise<string>((resolve, reject) => {
      const socket = createConnection({ host: '127.0.0.1', port: Number(url.port) });
      let response = '';
      socket.setEncoding('utf8');
      socket.setTimeout(5000, () => socket.destroy(new Error('Wire test timed out.')));
      socket.on('connect', () =>
        socket.write([preamble, ...headers, 'Connection: close', '', body].join('\r\n')),
      );
      socket.on('data', (chunk: string) => {
        response += chunk;
      });
      socket.on('error', reject);
      socket.on('end', () => resolve(response));
    });
  }

  it('rejects raw duplicate, missing, comma and conflicting absolute-form authorities', async () => {
    for (const headers of [
      ['Host: ' + site, 'HOST: ' + site],
      [],
      ['Host: ' + site + ',' + dashboard],
    ]) {
      const response = await wire('GET ' + website + ' HTTP/1.1', headers);
      expect(response).toMatch(/^HTTP\/1\.1 400/);
      expect(response).not.toContain(site);
    }
    const response = await wire('GET http://' + dashboard + website + ' HTTP/1.1', [
      'Host: ' + site,
    ]);
    expect(response).toMatch(/^HTTP\/1\.1 400/);
    expect(response).toMatch(/x-request-id: [0-9a-f-]+/i);
    const lateDuplicate = await wire('GET ' + website + ' HTTP/1.1', [
      'Host: ' + site,
      ...Array<string>(2000).fill('A: x'),
      'Host: ' + dashboard,
    ]);
    expect(lateDuplicate).toMatch(/^HTTP\/1\.1 400/);
  });

  it('binds the published projection to Host and ignores direct spoofed forwarding', async () => {
    const response = await wire('GET ' + website + ' HTTP/1.1', [
      'Host: VENUE-ONE.SPORTIFY.LK:443',
      'Forwarded: host=' + dashboard,
      'X-Forwarded-Host: ' + dashboard,
    ]);
    expect(response).toMatch(/^HTTP\/1\.1 200/);
    expect(response).toContain('Fixture business');
    expect(log).toContainEqual(expect.objectContaining({ tenantPublicId: tenantA }));
    expect(await wire('GET ' + website + '?tenant_id=spoof HTTP/1.1', ['Host: ' + site])).toMatch(
      /^HTTP\/1\.1 400/,
    );
    expect(await wire('GET ' + website + ' HTTP/1.1', ['Host: unmapped.sportify.lk'])).toMatch(
      /^HTTP\/1\.1 404/,
    );
    published = false;
    try {
      expect(await wire('GET ' + website + ' HTTP/1.1', ['Host: ' + site])).toMatch(
        /^HTTP\/1\.1 404/,
      );
    } finally {
      published = true;
    }
  });

  it('keeps public and admin surfaces separate from dashboard membership', async () => {
    for (const host of [site, 'admin.sportify.lk', 'sportify.lk']) {
      expect(
        await wire('GET ' + workspace() + ' HTTP/1.1', [
          'Host: ' + host,
          'Cookie: ' + dashboardCookie(),
          'X-Forwarded-Host: ' + dashboard,
        ]),
      ).toMatch(/^HTTP\/1\.1 404/);
    }
    for (const headers of [
      ['Host: ' + dashboard],
      ['Host: ' + dashboard, 'Cookie: ' + dashboardCookie(adminSession)],
    ]) {
      expect(await wire('GET ' + workspace() + ' HTTP/1.1', headers)).toMatch(/^HTTP\/1\.1 401/);
    }
    expect(
      await wire('GET ' + workspace() + ' HTTP/1.1', [
        'Host: ' + dashboard,
        'Cookie: ' + dashboardCookie(),
        'X-Tenant-ID: sentinel',
      ]),
    ).toMatch(/^HTTP\/1\.1 400/);
    expect(
      await wire('POST ' + workspace() + ' HTTP/1.1', [
        'Host: ' + dashboard,
        'Cookie: ' + dashboardCookie(),
      ]),
    ).toMatch(/^HTTP\/1\.1 403/);
    const unguarded = await wire('GET /api/v1/tenants/' + tenantA + '/unguarded HTTP/1.1', [
      'Host: ' + dashboard,
      'Cookie: ' + dashboardCookie(),
    ]);
    expect(unguarded).toMatch(/^HTTP\/1\.1 403/);
    expect(unguarded).not.toContain('disclosure');
  });

  it('keeps two parallel selectors independent and rechecks membership after revocation', async () => {
    const request = (candidate: string) =>
      wire('GET ' + workspace(candidate) + ' HTTP/1.1', [
        'Host: ' + dashboard,
        'Cookie: ' + dashboardCookie(),
      ]);
    const [first, second] = await Promise.all([request(tenantA), request(tenantB)]);
    expect(first).toContain('"TOTAL_CAPACITY":"41"');
    expect(second).toContain('"TOTAL_CAPACITY":"52"');
    allowed.delete(tenantB);
    try {
      const denied = await request(tenantB);
      expect(denied).toMatch(/^HTTP\/1\.1 404/);
      expect(denied).not.toContain(tenantB);
      expect(await request(tenantA)).toMatch(/^HTTP\/1\.1 200/);
      expect(JSON.stringify(log)).not.toContain(session);
    } finally {
      allowed.set(tenantB, '52');
    }
  });

  it('requires mutation intent, checks CSRF and binds every transaction statement to one tenant', async () => {
    const nonce = newSessionSecret();
    const proof =
      nonce +
      '.' +
      createHmac('sha256', config.csrfKey)
        .update(
          JSON.stringify(['sportify.dashboard.csrf.v1', 'https://' + dashboard, nonce, session]),
        )
        .digest('base64url');
    const path = '/api/v1/tenants/' + tenantA + '/resources';
    const base = [
      'Host: ' + dashboard,
      'Cookie: ' + dashboardCookie() + '; __Host-sportify_csrf=' + nonce,
      'Origin: https://' + dashboard,
      'X-CSRF-Token: ' + proof,
    ];
    expect(await wire('GET ' + path + ' HTTP/1.1', base)).toMatch(/^HTTP\/1\.1 403/);
    expect(await wire('POST ' + path + '?tenant%5Fid=conflict HTTP/1.1', base)).toMatch(
      /^HTTP\/1\.1 400/,
    );
    const body = JSON.stringify({ tenantPublicId: tenantB });
    expect(
      await wire(
        'POST ' + path + ' HTTP/1.1',
        [...base, 'Content-Type: application/json', 'Content-Length: ' + Buffer.byteLength(body)],
        body,
      ),
    ).toMatch(/^HTTP\/1\.1 400/);
    expect(await wire('POST ' + path + ' HTTP/1.1', base)).toMatch(/^HTTP\/1\.1 201/);
    expect(statements).toHaveLength(6);
    for (const { sql, binds } of statements) {
      expect(sql).toContain('TENANT_ID = :tenantId');
      expect(binds?.tenantId).toBe('41');
    }
    expect(statements[0]?.binds).toHaveProperty('locationPublicId', tenantA);
    expect(statements[0]?.sql).toContain(
      'bs.TENANT_ID = l.TENANT_ID AND bs.BUSINESS_ID = l.BUSINESS_ID',
    );
    expect(statements[5]?.sql).toContain('candidate.TENANT_ID = :tenantId');
    expect(statements[5]?.binds).toMatchObject({ item0: tenantA, item1: tenantB, expected: 2 });
  });

  it('works through a real local preserving proxy that removes competing authority fields', async () => {
    const proxy = createServer((request, response) => {
      const forward = upstreamRequest(
        url,
        { path: request.url, headers: { Host: request.headers.host ?? '' } },
        (upstream) => {
          response.writeHead(upstream.statusCode ?? 502, upstream.headers);
          upstream.pipe(response);
        },
      );
      forward.on('error', () => response.writeHead(502).end());
      forward.end();
    });
    await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));
    try {
      const address = proxy.address();
      if (!address || typeof address === 'string') throw new Error('Missing test listener.');
      const proxyResponse = (host: string) =>
        new Promise<number | undefined>((resolve, reject) => {
          const request = upstreamRequest(
            {
              hostname: '127.0.0.1',
              port: address.port,
              path: website,
              headers: { Host: host, 'X-Forwarded-Host': site, Forwarded: 'host=' + site },
            },
            (response) => {
              response.resume();
              resolve(response.statusCode);
            },
          );
          request.on('error', reject);
          request.end();
        });
      expect(await proxyResponse(site)).toBe(200);
      expect(await proxyResponse('unknown.sportify.lk')).toBe(404);
      expect(await proxyResponse('untrusted.example')).toBe(400);
    } finally {
      await new Promise<void>((resolve) => proxy.close(() => resolve()));
    }
  });

  it('fails before SQL when private scope is missing or forged', () => {
    const repos = new TenantRepositories(db, owner);
    const queries = query.mock.calls.length;
    const transactions = transaction.mock.calls.length;
    expect(() => repos.resources({ tenantId: '41' } as never)).toThrow(ApplicationError);
    expect(() => repos.transaction(undefined as never, () => Promise.resolve())).toThrow(
      ApplicationError,
    );
    expect(query).toHaveBeenCalledTimes(queries);
    expect(transaction).toHaveBeenCalledTimes(transactions);
  });
});
