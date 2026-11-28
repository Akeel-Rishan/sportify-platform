import type { Database } from '@sportify/database';
import { ApplicationError } from '../../common/errors/application-error.js';
import {
  recordTenant,
  requestId,
  type ApiRequest,
} from '../../common/middleware/request-context.js';
import type { AccountService } from '../auth/account.service.js';
import type { BrowserAuth } from '../auth/browser-security.js';
import { publicIdPattern, rejectOtherTenantSelectors, requestSurface } from './host-boundary.js';

export type TenantOwner = 'SPORTIFY_SCHEMA_OWNER' | 'SPORTIFY_STEP13_TEST_OWNER';
export function tenantOwner(owner: TenantOwner): TenantOwner {
  if (owner !== 'SPORTIFY_SCHEMA_OWNER' && owner !== 'SPORTIFY_STEP13_TEST_OWNER')
    throw new Error('Unknown tenant repository owner.');
  return owner;
}

interface TenantIdentity {
  readonly tenantId: string;
  readonly tenantPublicId: string;
  readonly requestId: string;
}

export interface WebsiteContext extends TenantIdentity {
  readonly surface: 'tenant-website';
  readonly websiteId: string;
  readonly businessId: string;
  readonly slug: string;
}

export interface MemberContext extends TenantIdentity {
  readonly surface: 'tenant-member';
  readonly accountPublicId: string;
  readonly membershipId: string;
  readonly intent: 'read' | 'mutation';
}

// Only this resolver can mint capabilities. Structural TypeScript casts and
// copies of valid contexts do not grant access.
const contexts = new WeakMap<WebsiteContext | MemberContext, TenantOwner>();

export function requireTenantContext<T extends WebsiteContext | MemberContext>(
  context: T,
  audience: T['surface'],
  owner: TenantOwner,
): T {
  if (contexts.get(context) !== owner || context.surface !== audience)
    throw new ApplicationError('FORBIDDEN');
  return context;
}

const websiteEligibility = `
  t.DELETED_AT_UTC IS NULL AND t.STATUS IN ('TRIAL','ACTIVE','SUSPENDED')
  AND b.BUSINESS_STATUS = 'ACTIVE' AND w.WEBSITE_STATUS = 'PUBLISHED'`;

export function publishedWebsite(owner: TenantOwner): string {
  const schema = tenantOwner(owner);
  return `FROM ${schema}.WEBSITE_SETTINGS w
    JOIN ${schema}.TENANTS t ON t.TENANT_ID = w.TENANT_ID
    JOIN ${schema}.BUSINESSES b ON b.TENANT_ID = w.TENANT_ID AND b.BUSINESS_ID = w.BUSINESS_ID`;
}

export { websiteEligibility };

interface DashboardAuthentication {
  readonly browser: BrowserAuth;
  readonly accounts: AccountService;
}

export class TenantResolver {
  private readonly owner: TenantOwner;

  constructor(
    private readonly database: Database,
    owner: TenantOwner,
    private readonly dashboard?: DashboardAuthentication,
  ) {
    this.owner = tenantOwner(owner);
  }

  async website(request: ApiRequest): Promise<WebsiteContext> {
    const host = requestSurface(request);
    if (host.surface !== 'tenant-website') throw new ApplicationError('NOT_FOUND');
    rejectOtherTenantSelectors(request);
    const { rows } = await this.database.query<{
      TENANT_ID: string;
      TENANT_PUBLIC_ID: string;
      WEBSITE_ID: string;
      BUSINESS_ID: string;
    }>(
      `SELECT w.TENANT_ID, t.PUBLIC_ID AS TENANT_PUBLIC_ID, w.WEBSITE_ID, w.BUSINESS_ID
        ${publishedWebsite(this.owner)}
        WHERE w.SUBDOMAIN_SLUG = :slug AND ${websiteEligibility}`,
      { slug: host.slug },
    );
    const row = rows?.[0];
    if (!row) throw new ApplicationError('NOT_FOUND');
    const context: WebsiteContext = Object.freeze({
      surface: 'tenant-website',
      tenantId: row.TENANT_ID,
      tenantPublicId: row.TENANT_PUBLIC_ID,
      websiteId: row.WEBSITE_ID,
      businessId: row.BUSINESS_ID,
      slug: host.slug,
      requestId: requestId(request),
    });
    contexts.set(context, this.owner);
    recordTenant(request, context.tenantPublicId);
    return context;
  }

  async member(request: ApiRequest): Promise<MemberContext> {
    const host = requestSurface(request);
    if (host.surface !== 'dashboard' || !host.tenantCandidate)
      throw new ApplicationError('NOT_FOUND');
    if (!this.dashboard) throw new ApplicationError('UNAUTHENTICATED');
    rejectOtherTenantSelectors(request);
    const { browser, accounts } = this.dashboard;
    const read = request.method === 'GET' || request.method === 'HEAD';
    if (read) browser.checkOrigin(request, false);
    else if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method))
      throw new ApplicationError('METHOD_NOT_ALLOWED');
    const token = read ? browser.session(request) : browser.checkMutation(request);
    const account = await accounts.me(token, request.socket.remoteAddress);
    if (!publicIdPattern.test(host.tenantCandidate)) throw new ApplicationError('NOT_FOUND');
    const { rows } = await this.database.query<{
      TENANT_ID: string;
      TENANT_PUBLIC_ID: string;
      MEMBERSHIP_ID: string;
    }>(
      `SELECT t.TENANT_ID, t.PUBLIC_ID AS TENANT_PUBLIC_ID, m.MEMBERSHIP_ID
        FROM ${this.owner}.TENANTS t
        JOIN ${this.owner}.TENANT_USERS m ON m.TENANT_ID = t.TENANT_ID
        JOIN ${this.owner}.USERS u ON u.USER_ID = m.USER_ID
        WHERE t.PUBLIC_ID = :tenantPublicId AND u.PUBLIC_ID = :accountPublicId
          AND t.DELETED_AT_UTC IS NULL AND t.STATUS IN ('PENDING_ONBOARDING','TRIAL','ACTIVE','SUSPENDED')
          AND u.ACCOUNT_STATUS = 'ACTIVE' AND u.EMAIL_VERIFIED_AT_UTC IS NOT NULL
          AND m.MEMBERSHIP_STATUS = 'ACTIVE'`,
      { tenantPublicId: host.tenantCandidate, accountPublicId: account.publicId },
    );
    const row = rows?.[0];
    if (!row) throw new ApplicationError('NOT_FOUND');
    const context: MemberContext = Object.freeze({
      surface: 'tenant-member',
      tenantId: row.TENANT_ID,
      tenantPublicId: row.TENANT_PUBLIC_ID,
      membershipId: row.MEMBERSHIP_ID,
      accountPublicId: account.publicId,
      intent: read ? 'read' : 'mutation',
      requestId: requestId(request),
    });
    contexts.set(context, this.owner);
    recordTenant(request, context.tenantPublicId);
    return context;
  }
}
