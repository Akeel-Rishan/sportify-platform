import { randomUUID } from 'node:crypto';
import type { Database, SqlConnection } from '@sportify/database';
import { ApplicationError } from '../../common/errors/application-error.js';
import { publicIdPattern } from './host-boundary.js';
import {
  publishedWebsite,
  requireTenantContext,
  tenantOwner,
  websiteEligibility,
  type MemberContext,
  type TenantOwner,
  type WebsiteContext,
} from './tenant-context.js';

interface ResourceRead {
  PUBLIC_ID: string;
  RESOURCE_NAME: string;
  RESOURCE_STATUS: string;
  LOCATION_NAME: string;
}
export interface ResourceInput {
  readonly locationPublicId: string;
  readonly sportCode: string;
  readonly code: string;
  readonly name: string;
  readonly type: string;
}

function validPublicId(value: string): void {
  if (!publicIdPattern.test(value)) throw new ApplicationError('BAD_REQUEST');
}

function resourceRead(owner: TenantOwner): string {
  return `SELECT r.PUBLIC_ID, r.RESOURCE_NAME, r.RESOURCE_STATUS, l.LOCATION_NAME
    FROM ${owner}.RESOURCES r JOIN ${owner}.LOCATIONS l
      ON l.TENANT_ID = r.TENANT_ID AND l.BUSINESS_ID = r.BUSINESS_ID
      AND l.LOCATION_ID = r.LOCATION_ID
    WHERE r.TENANT_ID = :tenantId`;
}

function resourceReader(sql: SqlConnection, owner: TenantOwner, tenantId: string) {
  return Object.freeze({
    async find(publicId: string) {
      validPublicId(publicId);
      const { rows } = await sql.execute<ResourceRead>(
        resourceRead(owner) + ' AND r.PUBLIC_ID = :publicId',
        { tenantId, publicId },
      );
      return rows?.[0] ?? null;
    },
    async list() {
      const { rows } = await sql.execute<ResourceRead>(
        resourceRead(owner) + ' ORDER BY r.RESOURCE_ID FETCH FIRST 100 ROWS ONLY',
        { tenantId },
      );
      return rows ?? [];
    },
    async totals() {
      const { rows } = await sql.execute<{ RESOURCE_COUNT: string; TOTAL_CAPACITY: string }>(
        `SELECT COUNT(*) AS RESOURCE_COUNT, NVL(SUM(r.CAPACITY),0) AS TOTAL_CAPACITY
           FROM ${owner}.RESOURCES r WHERE r.TENANT_ID = :tenantId`,
        { tenantId },
      );
      if (!rows?.[0]) throw new Error('Missing scoped aggregate.');
      return rows[0];
    },
  });
}

function resourceTransaction(sql: SqlConnection, owner: TenantOwner, context: MemberContext) {
  const scope = {
    tenantId: context.tenantId,
    membershipId: context.membershipId,
    accountPublicId: context.accountPublicId,
  };
  // Recheck admission for every write. Normal Oracle statement visibility
  // allows already-admitted work to finish when state changes concurrently.
  const eligibility = `EXISTS (
    SELECT 1 FROM ${owner}.TENANTS t
    JOIN ${owner}.TENANT_USERS m ON m.TENANT_ID = t.TENANT_ID
    JOIN ${owner}.USERS u ON u.USER_ID = m.USER_ID
    WHERE t.TENANT_ID = :tenantId AND t.DELETED_AT_UTC IS NULL
      AND t.STATUS IN ('TRIAL','ACTIVE')
      AND m.MEMBERSHIP_ID = :membershipId AND m.MEMBERSHIP_STATUS = 'ACTIVE'
      AND u.PUBLIC_ID = :accountPublicId AND u.ACCOUNT_STATUS = 'ACTIVE'
      AND u.EMAIL_VERIFIED_AT_UTC IS NOT NULL
  )`;
  return Object.freeze({
    ...resourceReader(sql, owner, scope.tenantId),
    async insert(input: ResourceInput) {
      validPublicId(input.locationPublicId);
      const publicId = randomUUID();
      const result = await sql.execute(
        `INSERT INTO ${owner}.RESOURCES
            (TENANT_ID, BUSINESS_ID, LOCATION_ID, SPORT_ID, RESOURCE_CODE, RESOURCE_NAME,
             RESOURCE_TYPE, PUBLIC_ID)
          SELECT l.TENANT_ID, l.BUSINESS_ID, l.LOCATION_ID, s.SPORT_ID,
            :resourceCode, :resourceName, :resourceType, :publicId
          FROM ${owner}.LOCATIONS l
          JOIN ${owner}.BUSINESS_SPORTS bs
            ON bs.TENANT_ID = l.TENANT_ID AND bs.BUSINESS_ID = l.BUSINESS_ID
            AND bs.STATUS = 'ACTIVE'
          JOIN ${owner}.SPORTS s ON s.SPORT_ID = bs.SPORT_ID AND s.SPORT_CODE = :sportCode
          WHERE l.TENANT_ID = :tenantId AND l.PUBLIC_ID = :locationPublicId
            AND ${eligibility}`,
        {
          ...scope,
          publicId,
          resourceCode: input.code,
          resourceName: input.name,
          resourceType: input.type,
          locationPublicId: input.locationPublicId,
          sportCode: input.sportCode,
        },
      );
      return result.rowsAffected === 1 ? publicId : null;
    },
    async remove(publicId: string) {
      validPublicId(publicId);
      const result = await sql.execute(
        `DELETE FROM ${owner}.RESOURCES r
          WHERE r.TENANT_ID = :tenantId AND r.PUBLIC_ID = :publicId AND ${eligibility}`,
        { ...scope, publicId },
      );
      return result.rowsAffected === 1;
    },
    async rename(publicId: string, name: string) {
      validPublicId(publicId);
      const result = await sql.execute(
        `UPDATE ${owner}.RESOURCES r SET RESOURCE_NAME = :resourceName, UPDATED_AT_UTC = LOCALTIMESTAMP
          WHERE r.TENANT_ID = :tenantId AND r.PUBLIC_ID = :publicId AND ${eligibility}`,
        { ...scope, publicId, resourceName: name },
      );
      return result.rowsAffected === 1;
    },
    async deactivate(publicIds: readonly string[]) {
      if (
        publicIds.length === 0 ||
        publicIds.length > 100 ||
        new Set(publicIds).size !== publicIds.length
      )
        throw new ApplicationError('BAD_REQUEST');
      publicIds.forEach(validPublicId);
      const ids = Object.fromEntries(publicIds.map((id, index) => ['item' + index, id]));
      const binds = Object.keys(ids)
        .map((key) => ':' + key)
        .join(', ');
      // One statement admits the batch only if every ID belongs to this tenant.
      const result = await sql.execute(
        `UPDATE ${owner}.RESOURCES r SET RESOURCE_STATUS = 'INACTIVE', UPDATED_AT_UTC = LOCALTIMESTAMP
          WHERE r.TENANT_ID = :tenantId AND r.PUBLIC_ID IN (${binds})
          AND ${eligibility}
          AND (SELECT COUNT(*) FROM ${owner}.RESOURCES candidate
            WHERE candidate.TENANT_ID = :tenantId AND candidate.PUBLIC_ID IN (${binds})) = :expected`,
        { ...ids, ...scope, expected: publicIds.length },
      );
      return result.rowsAffected === publicIds.length;
    },
  });
}

export class TenantRepositories {
  private readonly owner: TenantOwner;
  private readonly reader: SqlConnection;

  constructor(
    private readonly database: Database,
    owner: TenantOwner,
  ) {
    this.owner = tenantOwner(owner);
    this.reader = { execute: database.query.bind(database) };
  }

  resources(context: MemberContext) {
    const { tenantId } = requireTenantContext(context, 'tenant-member', this.owner);
    return resourceReader(this.reader, this.owner, tenantId);
  }

  transaction<T>(
    context: MemberContext,
    work: (resources: ReturnType<typeof resourceTransaction>) => Promise<T>,
  ): Promise<T> {
    requireTenantContext(context, 'tenant-member', this.owner);
    if (context.intent !== 'mutation') throw new ApplicationError('FORBIDDEN');
    return this.database.transaction((sql) => work(resourceTransaction(sql, this.owner, context)));
  }

  async website(context: WebsiteContext) {
    const { tenantId, businessId, websiteId, slug } = requireTenantContext(
      context,
      'tenant-website',
      this.owner,
    );
    const { rows } = await this.reader.execute<{
      BUSINESS_NAME: string;
      PAGE_TITLE: string | null;
    }>(
      `SELECT b.BUSINESS_NAME, w.PAGE_TITLE
        ${publishedWebsite(this.owner)}
        WHERE w.TENANT_ID = :tenantId AND w.BUSINESS_ID = :businessId
          AND w.WEBSITE_ID = :websiteId AND w.SUBDOMAIN_SLUG = :slug AND ${websiteEligibility}`,
      { tenantId, businessId, websiteId, slug },
    );
    return rows?.[0] ?? null;
  }
}
