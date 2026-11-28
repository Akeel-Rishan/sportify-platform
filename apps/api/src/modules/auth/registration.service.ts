import { randomUUID } from 'node:crypto';
import type { Database, SqlConnection } from '@sportify/database';
import {
  deriveVerificationToken,
  tokenDigest,
  verificationEvent,
} from '@sportify/verification-email';
import { ApplicationError } from '../../common/errors/application-error.js';
import type { RegistrationConfig } from './auth-config.js';
import type { ConfirmDto, RegisterDto } from './auth.dto.js';
import { createPasswordEncoder } from './password.js';
import { createAbuseControls, uniqueViolation } from './abuse-controls.js';

export type RegistrationOwner = 'SPORTIFY_SCHEMA_OWNER' | 'SPORTIFY_STEP11_TEST_OWNER';
export type RegistrationSourceScope = 'ISSUE' | 'CONFIRM';

const ownerPermissions = [
  'business.read',
  'business.manage',
  'location.read',
  'location.manage',
  'resource.read',
  'resource.manage',
  'booking.read',
  'booking.create',
  'booking.cancel',
  'booking.manage',
  'payment.read',
  'payment.record',
  'payment.refund',
  'staff.manage',
  'report.read',
  'website.manage',
  'subscription.read',
  'customer.read',
  'customer.manage',
] as const;
const permissionBinds = Object.fromEntries(
  ownerPermissions.map((permission, index) => [`p${index}`, permission]),
);
const permissionPlaceholders = Object.keys(permissionBinds)
  .map((key) => `:${key}`)
  .join(', ');

interface PendingUser {
  USER_ID: string;
  PUBLIC_ID: string;
}
interface Verification extends PendingUser {
  VERIFICATION_ID: string;
  TOKEN_KEY_VERSION: string;
}

export class RegistrationService {
  private readonly counter: ReturnType<typeof createAbuseControls>;
  private readonly encodePassword: (password: string) => Promise<string>;

  constructor(
    private readonly db: Database,
    private readonly owner: RegistrationOwner,
    private readonly config: RegistrationConfig,
    encodePassword = createPasswordEncoder(config.passwordBlocklist),
  ) {
    if (owner !== 'SPORTIFY_SCHEMA_OWNER' && owner !== 'SPORTIFY_STEP11_TEST_OWNER')
      throw new Error('An approved registration schema is required.');
    this.encodePassword = encodePassword;
    this.counter = createAbuseControls(db, owner, config.sourceKey);
  }

  admit(address: string | undefined, scope: RegistrationSourceScope): Promise<void> {
    const limit = scope === 'ISSUE' ? this.config.issueLimit : this.config.confirmLimit;
    return this.counter(address, scope, limit);
  }

  async register(input: RegisterDto, request: string): Promise<void> {
    const id = randomUUID();
    const email = input.email.toLowerCase();
    await this.db.transaction(async (connection) => {
      try {
        await connection.execute(
          `INSERT INTO ${this.owner}.USERS (PUBLIC_ID,FULL_NAME,EMAIL,EMAIL_NORMALIZED,MOBILE_E164,ACCOUNT_STATUS)
           VALUES (:id,:fullName,:displayEmail,:email,:mobile,'PENDING')`,
          { id, fullName: input.fullName, displayEmail: input.email, email, mobile: input.mobile },
        );
      } catch (error) {
        if (uniqueViolation(error, this.owner, 'UQ_USERS_EMAIL_NORMALIZED')) return;
        throw error;
      }
      const result = await connection.execute<PendingUser>(
        `SELECT USER_ID,PUBLIC_ID FROM ${this.owner}.USERS WHERE PUBLIC_ID=:id`,
        { id },
      );
      const user = result.rows?.[0];
      if (!user) throw new Error('Pending account insert did not produce an identity.');
      await this.issue(connection, user);
      await connection.execute(
        `INSERT INTO ${this.owner}.AUDIT_LOGS (PUBLIC_ID,SCOPE_KIND,ACTOR_TYPE,ACTOR_SERVICE,ACTION_CODE,ENTITY_TYPE,ENTITY_PUBLIC_ID,REQUEST_ID)
         VALUES (:id,'PLATFORM','SYSTEM','auth-registration','auth.registration.accepted','USER',:userId,:requestId)`,
        { id: randomUUID(), userId: user.PUBLIC_ID, requestId: request },
      );
    });
  }

  async resend(address: string): Promise<void> {
    await this.db.transaction(async (connection) => {
      const result = await connection.execute<PendingUser>(
        `SELECT USER_ID,PUBLIC_ID FROM ${this.owner}.USERS WHERE EMAIL_NORMALIZED=:email FOR UPDATE`,
        { email: address.toLowerCase() },
      );
      const user = result.rows?.[0];
      if (!user) return;
      const { rows: eligible } = await connection.execute(
        `SELECT USER_ID FROM ${this.owner}.USERS WHERE USER_ID=:p_user_id AND ACCOUNT_STATUS='PENDING' AND EMAIL_VERIFIED_AT_UTC IS NULL`,
        { p_user_id: user.USER_ID },
      );
      if (!eligible?.length) return;
      const { rows } = await connection.execute<{ TOTAL: string; COOLDOWN: string }>(
        `SELECT COUNT(*) TOTAL, COUNT(CASE WHEN CREATED_AT_UTC>LOCALTIMESTAMP-INTERVAL '60' SECOND THEN 1 END) COOLDOWN
         FROM ${this.owner}.EMAIL_VERIFICATION_TOKENS
         WHERE USER_ID=:p_user_id AND CREATED_AT_UTC>LOCALTIMESTAMP-INTERVAL '15' MINUTE`,
        { p_user_id: user.USER_ID },
      );
      if (!rows?.[0] || Number(rows[0].TOTAL) >= 3 || rows[0].COOLDOWN !== '0') return;
      await connection.execute(
        `UPDATE ${this.owner}.EMAIL_VERIFICATION_TOKENS SET REVOKED_AT_UTC=LOCALTIMESTAMP
         WHERE USER_ID=:p_user_id AND CONSUMED_AT_UTC IS NULL AND REVOKED_AT_UTC IS NULL AND EXPIRES_AT_UTC>LOCALTIMESTAMP`,
        { p_user_id: user.USER_ID },
      );
      await this.issue(connection, user);
    });
  }

  async confirm(input: ConfirmDto, request: string): Promise<void> {
    const digest = tokenDigest(input.token);
    const eligibleSql = `SELECT u.USER_ID,u.PUBLIC_ID,t.VERIFICATION_ID,t.TOKEN_KEY_VERSION
      FROM ${this.owner}.EMAIL_VERIFICATION_TOKENS t JOIN ${this.owner}.USERS u ON u.USER_ID=t.USER_ID
      WHERE t.TOKEN_HASH=:digest AND u.ACCOUNT_STATUS='PENDING' AND u.EMAIL_VERIFIED_AT_UTC IS NULL
        AND t.CONSUMED_AT_UTC IS NULL AND t.REVOKED_AT_UTC IS NULL AND t.EXPIRES_AT_UTC>LOCALTIMESTAMP`;
    const isEligible = (row: Verification | undefined): row is Verification =>
      row !== undefined && this.config.keys.has(row.TOKEN_KEY_VERSION);
    const initial = (await this.db.query<Verification>(eligibleSql, { digest })).rows?.[0];
    if (!isEligible(initial)) throw new ApplicationError('BAD_REQUEST');
    // Screening and Argon2 never hold a borrowed Oracle connection or a user lock.
    const hash = await this.encodePassword(input.password);
    await this.db.transaction(async (connection) => {
      await connection.execute(
        `SELECT USER_ID FROM ${this.owner}.USERS WHERE USER_ID=:p_user_id FOR UPDATE`,
        { p_user_id: initial.USER_ID },
      );
      const current = (await connection.execute<Verification>(eligibleSql, { digest })).rows?.[0];
      if (!isEligible(current) || current.USER_ID !== initial.USER_ID)
        throw new ApplicationError('BAD_REQUEST');
      const consumed = await connection.execute(
        `UPDATE ${this.owner}.EMAIL_VERIFICATION_TOKENS SET CONSUMED_AT_UTC=LOCALTIMESTAMP
         WHERE VERIFICATION_ID=:id AND CONSUMED_AT_UTC IS NULL AND REVOKED_AT_UTC IS NULL AND EXPIRES_AT_UTC>LOCALTIMESTAMP`,
        { id: current.VERIFICATION_ID },
      );
      if (consumed.rowsAffected !== 1) throw new ApplicationError('BAD_REQUEST');
      await connection.execute(
        `UPDATE ${this.owner}.USERS SET FULL_NAME=:name,MOBILE_E164=:mobile,PASSWORD_HASH=:hash,ACCOUNT_STATUS='ACTIVE',
         EMAIL_VERIFIED_AT_UTC=LOCALTIMESTAMP,UPDATED_AT_UTC=LOCALTIMESTAMP WHERE USER_ID=:p_user_id`,
        { name: input.fullName, mobile: input.mobile, hash, p_user_id: current.USER_ID },
      );
      await this.createOwner(connection, current, input.tenantName, request);
    });
  }

  private async issue(connection: SqlConnection, user: PendingUser): Promise<void> {
    const { rows } = await connection.execute<{ EXPIRES_AT: string }>(
      `SELECT TO_CHAR(LOCALTIMESTAMP+INTERVAL '60' MINUTE,'YYYY-MM-DD"T"HH24:MI:SS.FF6') AS EXPIRES_AT FROM DUAL`,
    );
    const expiresAt = rows?.[0]?.EXPIRES_AT;
    const keyVersion = this.config.activeVersion;
    const key = this.config.keys.get(keyVersion);
    if (!expiresAt || !key) throw new Error('Verification issuance prerequisites failed.');
    const tokenId = randomUUID();
    const token = deriveVerificationToken(
      { tokenId, userId: user.PUBLIC_ID, keyVersion, expiresAt },
      key,
    );
    await connection.execute(
      `INSERT INTO ${this.owner}.EMAIL_VERIFICATION_TOKENS (USER_ID,PUBLIC_ID,TOKEN_KEY_VERSION,TOKEN_HASH,EXPIRES_AT_UTC)
       VALUES (:p_user_id,:id,:keyVersion,:hash,TO_TIMESTAMP(:expiresAt,'YYYY-MM-DD"T"HH24:MI:SS.FF6'))`,
      { p_user_id: user.USER_ID, id: tokenId, keyVersion, hash: tokenDigest(token), expiresAt },
    );
    await connection.execute(
      `INSERT INTO ${this.owner}.OUTBOX_EVENTS
        (SCOPE_KIND,AGGREGATE_TYPE,AGGREGATE_ID,EVENT_TYPE,PAYLOAD,AVAILABLE_AT_UTC,MAX_ATTEMPTS)
       VALUES ('PLATFORM','EMAIL_VERIFICATION',:id,:eventType,:payload,LOCALTIMESTAMP,:maxAttempts)`,
      {
        id: tokenId,
        eventType: verificationEvent,
        payload: JSON.stringify({ tokenId, keyVersion }),
        maxAttempts: this.config.maxAttempts,
      },
    );
  }

  private async createOwner(
    connection: SqlConnection,
    user: PendingUser,
    tenantName: string,
    request: string,
  ): Promise<void> {
    const tenantPublicId = randomUUID();
    await connection.execute(
      `INSERT INTO ${this.owner}.TENANTS (PUBLIC_ID,TENANT_CODE,TENANT_NAME,STATUS)
       VALUES (:id,:code,:name,'PENDING_ONBOARDING')`,
      { id: tenantPublicId, code: tenantPublicId, name: tenantName },
    );
    const tenant = (
      await connection.execute<{ TENANT_ID: string }>(
        `SELECT TENANT_ID FROM ${this.owner}.TENANTS WHERE PUBLIC_ID=:id`,
        { id: tenantPublicId },
      )
    ).rows?.[0]?.TENANT_ID;
    if (!tenant) throw new Error('Tenant insert did not produce an identity.');
    const membershipPublicId = randomUUID();
    await connection.execute(
      `INSERT INTO ${this.owner}.TENANT_USERS (TENANT_ID,USER_ID,PUBLIC_ID,MEMBERSHIP_STATUS,JOINED_AT_UTC)
       VALUES (:tenant,:userId,:id,'ACTIVE',LOCALTIMESTAMP)`,
      { tenant, userId: user.USER_ID, id: membershipPublicId },
    );
    // Execute separately because INSERT ALL can reuse one identity value for multiple branches.
    for (const [code, name, active] of [
      ['BUSINESS_OWNER', 'Business owner', 'Y'],
      ['BUSINESS_MANAGER', 'Business manager', 'N'],
      ['RECEPTIONIST', 'Receptionist', 'N'],
    ] as const) {
      await connection.execute(
        `INSERT INTO ${this.owner}.ROLES (TENANT_ID,ROLE_CODE,ROLE_NAME,IS_SYSTEM_ROLE,IS_ACTIVE)
         VALUES (:tenant,:code,:name,'Y',:active)`,
        { tenant, code, name, active },
      );
    }
    const permissions = await connection.execute(
      `INSERT INTO ${this.owner}.ROLE_PERMISSIONS (TENANT_ID,ROLE_ID,PERMISSION_ID)
       SELECT r.TENANT_ID,r.ROLE_ID,p.PERMISSION_ID FROM ${this.owner}.ROLES r CROSS JOIN ${this.owner}.PERMISSIONS p
       WHERE r.TENANT_ID=:tenant AND r.ROLE_CODE='BUSINESS_OWNER' AND p.PERMISSION_CODE IN (${permissionPlaceholders})`,
      { tenant, ...permissionBinds },
    );
    if (permissions.rowsAffected !== ownerPermissions.length)
      throw new Error('Owner permission catalog is incomplete.');
    const assignment = await connection.execute(
      `INSERT INTO ${this.owner}.USER_ROLES (TENANT_ID,MEMBERSHIP_ID,ROLE_ID)
       SELECT m.TENANT_ID,m.MEMBERSHIP_ID,r.ROLE_ID
       FROM ${this.owner}.TENANT_USERS m JOIN ${this.owner}.ROLES r ON r.TENANT_ID=m.TENANT_ID
       WHERE m.TENANT_ID=:tenant AND m.PUBLIC_ID=:membershipId AND r.ROLE_CODE='BUSINESS_OWNER'`,
      { tenant, membershipId: membershipPublicId },
    );
    if (assignment.rowsAffected !== 1) throw new Error('Initial owner assignment failed.');
    for (const [action, entity, entityId] of [
      ['auth.email.verified', 'USER', user.PUBLIC_ID],
      ['auth.initial-owner.created', 'MEMBERSHIP', membershipPublicId],
    ] as const) {
      await connection.execute(
        `INSERT INTO ${this.owner}.AUDIT_LOGS
          (PUBLIC_ID,TENANT_ID,SCOPE_KIND,ACTOR_TYPE,ACTOR_USER_ID,ACTOR_MEMBERSHIP_ID,ACTION_CODE,ENTITY_TYPE,ENTITY_PUBLIC_ID,REQUEST_ID)
         SELECT :id,m.TENANT_ID,'TENANT','USER',m.USER_ID,m.MEMBERSHIP_ID,:action,:entity,:entityId,:requestId
         FROM ${this.owner}.TENANT_USERS m WHERE m.TENANT_ID=:tenant AND m.PUBLIC_ID=:membershipId`,
        {
          id: randomUUID(),
          action,
          entity,
          entityId,
          requestId: request,
          tenant,
          membershipId: membershipPublicId,
        },
      );
    }
  }
}
