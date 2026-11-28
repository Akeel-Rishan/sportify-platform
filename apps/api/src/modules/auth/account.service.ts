import { randomUUID } from 'node:crypto';
import type {
  AccountProfile,
  LoginRequest,
  PasswordResetConfirmation,
} from '@sportify/api-contracts';
import type { Database, SqlConnection } from '@sportify/database';
import {
  derivePasswordResetToken,
  passwordResetEvent,
  tokenDigest,
} from '@sportify/verification-email';
import { ApplicationError } from '../../common/errors/application-error.js';
import { createAbuseControls } from './abuse-controls.js';
import { newSessionSecret } from './browser-security.js';
import { createPasswordEncoder, type createPasswordVerifier } from './password.js';
import type { SessionConfig } from './session-config.js';

export type AccountOwner =
  'SPORTIFY_SCHEMA_OWNER' | 'SPORTIFY_STEP12_TEST_OWNER' | 'SPORTIFY_STEP13_TEST_OWNER';
type AccountRow = { USER_ID: string; PUBLIC_ID: string; FULL_NAME: string };
type LoginRow = AccountRow & { PASSWORD_HASH: string };
type ResetRow = AccountRow & { RESET_ID: string; TOKEN_KEY_VERSION: string };
type VerifyPassword = Awaited<ReturnType<typeof createPasswordVerifier>>;

function profile(account: AccountRow): AccountProfile {
  return { publicId: account.PUBLIC_ID, fullName: account.FULL_NAME, emailVerified: true };
}

export class AccountService {
  private readonly counter: ReturnType<typeof createAbuseControls>;
  private readonly encodePassword: (password: string) => Promise<string>;
  private readonly eligible: string;
  private readonly sessions: string;
  private readonly passwordResets: string;

  constructor(
    private readonly db: Database,
    private readonly owner: AccountOwner,
    private readonly config: SessionConfig,
    private readonly verifyPassword: VerifyPassword,
    encodePassword = createPasswordEncoder(config.passwordBlocklist),
  ) {
    if (
      ![
        'SPORTIFY_SCHEMA_OWNER',
        'SPORTIFY_STEP12_TEST_OWNER',
        'SPORTIFY_STEP13_TEST_OWNER',
      ].includes(owner)
    )
      throw new Error('An approved account authentication schema is required.');
    this.counter = createAbuseControls(db, owner, config.sourceKey);
    this.encodePassword = encodePassword;
    this.eligible = `u.ACCOUNT_STATUS='ACTIVE' AND u.EMAIL_VERIFIED_AT_UTC IS NOT NULL
      AND EXISTS (SELECT 1 FROM ${owner}.TENANT_USERS m WHERE m.USER_ID=u.USER_ID AND m.MEMBERSHIP_STATUS='ACTIVE')`;
    this.sessions = owner + '.VW_AUTH_DASHBOARD_SESSIONS';
    this.passwordResets = owner + '.PASSWORD_RESET_TOKENS';
  }

  async login(
    input: LoginRequest,
    address: string | undefined,
    previous: string | undefined,
    request: string,
  ) {
    const email = input.email.toLowerCase();
    await this.counter(address, 'LOGIN', this.config.loginSourceLimit);
    await this.counter(address, 'LOGIN_PAIR', this.config.loginPairLimit, email);
    const loginSql = `SELECT u.USER_ID,u.PUBLIC_ID,u.FULL_NAME,u.PASSWORD_HASH FROM ${this.owner}.USERS u
      WHERE u.EMAIL_NORMALIZED=:email AND ${this.eligible}`;
    const { rows } = await this.db.query<LoginRow>(loginSql, { email });
    const initial = rows?.[0];
    if (!(await this.verifyPassword(input.password, initial?.PASSWORD_HASH ?? null)) || !initial)
      throw new ApplicationError('UNAUTHENTICATED');

    return this.db.transaction(async (connection) => {
      await this.lockAccount(connection, initial.USER_ID);
      const current = (await connection.execute<LoginRow>(loginSql, { email })).rows?.[0];
      if (
        !current ||
        current.USER_ID !== initial.USER_ID ||
        current.PASSWORD_HASH !== initial.PASSWORD_HASH
      )
        throw new ApplicationError('UNAUTHENTICATED');
      if (previous) {
        await connection.execute(
          `UPDATE ${this.owner}.VW_AUTH_SESSION_REVOCATION SET REVOKED_AT_UTC=LOCALTIMESTAMP,REVOKE_REASON='ROTATED'
           WHERE SESSION_ID IN (SELECT SESSION_ID FROM ${this.sessions} WHERE TOKEN_HASH=:digest AND USER_ID=:accountId)`,
          { digest: tokenDigest(previous), accountId: current.USER_ID },
        );
      }
      const token = newSessionSecret();
      const digest = tokenDigest(token);
      await connection.execute(
        `INSERT INTO ${this.sessions} (USER_ID,TOKEN_HASH,EXPIRES_AT_UTC,IDLE_EXPIRES_AT_UTC,LAST_SEEN_AT_UTC,AUDIENCE)
         VALUES (:accountId,:digest,LOCALTIMESTAMP+NUMTODSINTERVAL(:absoluteSeconds,'SECOND'),
           LOCALTIMESTAMP+NUMTODSINTERVAL(:idleSeconds,'SECOND'),LOCALTIMESTAMP,'DASHBOARD')`,
        {
          accountId: current.USER_ID,
          digest,
          absoluteSeconds: this.config.absoluteSeconds,
          idleSeconds: this.config.idleSeconds,
        },
      );
      const deadline = (
        await connection.execute<{ DEADLINE: string }>(
          `SELECT TO_CHAR(EXPIRES_AT_UTC,'YYYY-MM-DD"T"HH24:MI:SS.FF3') AS DEADLINE FROM ${this.sessions} WHERE TOKEN_HASH=:digest`,
          { digest },
        )
      ).rows?.[0]?.DEADLINE;
      const expires = new Date(deadline + 'Z');
      if (!deadline || !Number.isFinite(expires.getTime()))
        throw new Error('Expected a session expiry.');
      await this.audit(connection, current, 'auth.login.succeeded', request);
      return { account: profile(current), token, expires };
    });
  }

  async me(token: string | undefined, address: string | undefined): Promise<AccountProfile> {
    await this.counter(address, 'SESSION', this.config.sessionSourceLimit);
    if (!token) throw new ApplicationError('UNAUTHENTICATED');
    const digest = tokenDigest(token);
    const live =
      's.REVOKED_AT_UTC IS NULL AND s.EXPIRES_AT_UTC>LOCALTIMESTAMP AND s.IDLE_EXPIRES_AT_UTC>LOCALTIMESTAMP';
    const lookup = () =>
      this.db.query<AccountRow & { TOUCH_DUE: string }>(
        `SELECT u.USER_ID,u.PUBLIC_ID,u.FULL_NAME,
         CASE WHEN s.LAST_SEEN_AT_UTC<=LOCALTIMESTAMP-NUMTODSINTERVAL(:touchSeconds,'SECOND') THEN 'Y' ELSE 'N' END AS TOUCH_DUE
       FROM ${this.sessions} s JOIN ${this.owner}.USERS u ON u.USER_ID=s.USER_ID
       WHERE s.TOKEN_HASH=:digest AND ${live} AND ${this.eligible}`,
        { digest, touchSeconds: this.config.touchSeconds },
      );
    let account = (await lookup()).rows?.[0];
    if (!account) throw new ApplicationError('UNAUTHENTICATED');
    if (account.TOUCH_DUE === 'Y') {
      const touched = await this.db.transaction((connection) =>
        connection.execute(
          `UPDATE ${this.sessions} s SET
          IDLE_EXPIRES_AT_UTC=LEAST(EXPIRES_AT_UTC,LOCALTIMESTAMP+NUMTODSINTERVAL(:idleSeconds,'SECOND')),
          LAST_SEEN_AT_UTC=LOCALTIMESTAMP
         WHERE s.TOKEN_HASH=:digest AND ${live}
           AND LAST_SEEN_AT_UTC<=LOCALTIMESTAMP-NUMTODSINTERVAL(:touchSeconds,'SECOND')`,
          { digest, touchSeconds: this.config.touchSeconds, idleSeconds: this.config.idleSeconds },
        ),
      );
      if (touched.rowsAffected !== 1) account = (await lookup()).rows?.[0];
    }
    if (!account) throw new ApplicationError('UNAUTHENTICATED');
    return profile(account);
  }

  async logout(
    token: string | undefined,
    address: string | undefined,
    request: string,
  ): Promise<void> {
    if (!token) return;
    await this.counter(address, 'SESSION', this.config.sessionSourceLimit);
    const digest = tokenDigest(token);
    await this.db.transaction(async (connection) => {
      const account = (
        await connection.execute<AccountRow & { SESSION_ID: string }>(
          `SELECT u.USER_ID,u.PUBLIC_ID,u.FULL_NAME,s.SESSION_ID FROM ${this.sessions} s
          JOIN ${this.owner}.USERS u ON u.USER_ID=s.USER_ID
          WHERE s.TOKEN_HASH=:digest AND s.REVOKED_AT_UTC IS NULL`,
          { digest },
        )
      ).rows?.[0];
      if (!account) return;
      await this.lockAccount(connection, account.USER_ID);
      const result = await connection.execute(
        `UPDATE ${this.owner}.VW_AUTH_SESSION_REVOCATION SET REVOKED_AT_UTC=LOCALTIMESTAMP,REVOKE_REASON='LOGOUT'
         WHERE SESSION_ID=:sessionId AND USER_ID=:accountId AND REVOKED_AT_UTC IS NULL
           AND EXISTS (SELECT 1 FROM ${this.sessions} s WHERE s.SESSION_ID=:sessionId
             AND s.EXPIRES_AT_UTC>LOCALTIMESTAMP AND s.IDLE_EXPIRES_AT_UTC>LOCALTIMESTAMP)`,
        { sessionId: account.SESSION_ID, accountId: account.USER_ID },
      );
      if (result.rowsAffected === 1)
        await this.audit(connection, account, 'auth.logout.succeeded', request);
    });
  }

  async admitResetRequest(address: string | undefined) {
    await this.counter(address, 'RESET_REQ', this.config.resetRequestSourceLimit);
  }

  async requestReset(address: string, request: string): Promise<void> {
    const email = address.toLowerCase();
    await this.db.transaction(async (connection) => {
      const lock = await connection.execute<{ USER_ID: string }>(
        `SELECT USER_ID FROM ${this.owner}.USERS WHERE EMAIL_NORMALIZED=:email FOR UPDATE`,
        { email },
      );
      const accountId = lock.rows?.[0]?.USER_ID;
      if (!accountId) return;
      const account = (
        await connection.execute<AccountRow>(
          `SELECT u.USER_ID,u.PUBLIC_ID,u.FULL_NAME FROM ${this.owner}.USERS u
        WHERE u.USER_ID=:accountId AND u.EMAIL_NORMALIZED=:email AND ${this.eligible}`,
          { accountId, email },
        )
      ).rows?.[0];
      if (!account) return;
      const quota = (
        await connection.execute<{ TOTAL: string; COOLDOWN: string }>(
          `SELECT COUNT(*) TOTAL,COUNT(CASE WHEN CREATED_AT_UTC>LOCALTIMESTAMP-NUMTODSINTERVAL(:cooldown,'SECOND') THEN 1 END) COOLDOWN
         FROM ${this.passwordResets} WHERE USER_ID=:accountId AND CREATED_AT_UTC>LOCALTIMESTAMP-INTERVAL '15' MINUTE`,
          { accountId, cooldown: this.config.resetCooldownSeconds },
        )
      ).rows?.[0];
      if (!quota || Number(quota.TOTAL) >= this.config.resetAccountLimit || quota.COOLDOWN !== '0')
        return;
      const expiresAt = (
        await connection.execute<{ DEADLINE: string }>(
          `SELECT TO_CHAR(LOCALTIMESTAMP+NUMTODSINTERVAL(:resetSeconds,'SECOND'),'YYYY-MM-DD"T"HH24:MI:SS.FF6') AS DEADLINE FROM DUAL`,
          { resetSeconds: this.config.resetSeconds },
        )
      ).rows?.[0]?.DEADLINE;
      const keyVersion = this.config.resetKeyVersion;
      const key = this.config.resetKeys.get(keyVersion);
      if (!expiresAt || !key) throw new Error('Reset issuance prerequisites failed.');
      const tokenId = randomUUID();
      const token = derivePasswordResetToken(
        { tokenId, keyVersion, userId: account.PUBLIC_ID, expiresAt },
        key,
      );
      await this.revokeResetLinks(connection, accountId);
      await connection.execute(
        `INSERT INTO ${this.passwordResets} (USER_ID,PUBLIC_ID,TOKEN_HASH,TOKEN_KEY_VERSION,EXPIRES_AT_UTC)
         VALUES (:accountId,:id,:digest,:keyVersion,TO_TIMESTAMP(:expiresAt,'YYYY-MM-DD"T"HH24:MI:SS.FF6'))`,
        { accountId, id: tokenId, digest: tokenDigest(token), keyVersion, expiresAt },
      );
      await this.event(connection, passwordResetEvent, 'PASSWORD_RESET', tokenId, {
        tokenId,
        keyVersion,
      });
      await this.audit(connection, account, passwordResetEvent, request);
    });
  }

  async confirmReset(
    input: PasswordResetConfirmation,
    address: string | undefined,
    request: string,
  ): Promise<void> {
    await this.counter(address, 'RESET_OK', this.config.resetConfirmSourceLimit);
    const digest = tokenDigest(input.token);
    const eligible = `SELECT u.USER_ID,u.PUBLIC_ID,u.FULL_NAME,t.RESET_ID,t.TOKEN_KEY_VERSION
      FROM ${this.passwordResets} t JOIN ${this.owner}.USERS u ON u.USER_ID=t.USER_ID
      WHERE t.TOKEN_HASH=:digest AND ${this.eligible} AND t.CONSUMED_AT_UTC IS NULL
        AND t.REVOKED_AT_UTC IS NULL AND t.EXPIRES_AT_UTC>LOCALTIMESTAMP`;
    const initial = (await this.db.query<ResetRow>(eligible, { digest })).rows?.[0];
    if (!initial || !this.config.resetKeys.has(initial.TOKEN_KEY_VERSION))
      throw new ApplicationError('BAD_REQUEST');
    const encoded = await this.encodePassword(input.password);
    await this.db.transaction(async (connection) => {
      await this.lockAccount(connection, initial.USER_ID);
      const current = (await connection.execute<ResetRow>(eligible, { digest })).rows?.[0];
      if (
        !current ||
        current.USER_ID !== initial.USER_ID ||
        !this.config.resetKeys.has(current.TOKEN_KEY_VERSION)
      )
        throw new ApplicationError('BAD_REQUEST');
      const consumed = await connection.execute(
        `UPDATE ${this.passwordResets} SET CONSUMED_AT_UTC=LOCALTIMESTAMP WHERE RESET_ID=:resetId
          AND CONSUMED_AT_UTC IS NULL AND REVOKED_AT_UTC IS NULL AND EXPIRES_AT_UTC>LOCALTIMESTAMP`,
        { resetId: current.RESET_ID },
      );
      if (consumed.rowsAffected !== 1) throw new ApplicationError('BAD_REQUEST');
      const accountId = current.USER_ID;
      const updated = await connection.execute(
        `UPDATE ${this.owner}.USERS SET PASSWORD_HASH=:encoded,UPDATED_AT_UTC=LOCALTIMESTAMP WHERE USER_ID=:accountId`,
        { encoded, accountId },
      );
      if (updated.rowsAffected !== 1) throw new ApplicationError('BAD_REQUEST');
      await this.revokeResetLinks(connection, accountId);
      await connection.execute(
        `UPDATE ${this.owner}.VW_AUTH_SESSION_REVOCATION SET REVOKED_AT_UTC=LOCALTIMESTAMP,REVOKE_REASON='PASSWORD_RESET'
         WHERE USER_ID=:accountId AND REVOKED_AT_UTC IS NULL`,
        { accountId },
      );
      await this.audit(connection, current, 'auth.password-reset.completed', request);
      await this.event(connection, 'auth.password-reset.completed', 'USER', current.PUBLIC_ID, {
        userId: current.PUBLIC_ID,
      });
    });
  }

  private lockAccount(connection: SqlConnection, accountId: string) {
    return connection.execute(
      `SELECT USER_ID FROM ${this.owner}.USERS WHERE USER_ID=:accountId FOR UPDATE`,
      { accountId },
    );
  }

  private revokeResetLinks(connection: SqlConnection, accountId: string) {
    return connection.execute(
      `UPDATE ${this.passwordResets} SET REVOKED_AT_UTC=LOCALTIMESTAMP
       WHERE USER_ID=:accountId AND CONSUMED_AT_UTC IS NULL AND REVOKED_AT_UTC IS NULL
         AND EXPIRES_AT_UTC>LOCALTIMESTAMP`,
      { accountId },
    );
  }

  private audit(connection: SqlConnection, row: AccountRow, action: string, requestId: string) {
    return connection.execute(
      `INSERT INTO ${this.owner}.AUDIT_LOGS (PUBLIC_ID,SCOPE_KIND,ACTOR_TYPE,ACTOR_USER_ID,ACTION_CODE,ENTITY_TYPE,ENTITY_PUBLIC_ID,REQUEST_ID)
       VALUES (:id,'PLATFORM','USER',:accountId,:action,'USER',:publicId,:requestId)`,
      { id: randomUUID(), accountId: row.USER_ID, action, publicId: row.PUBLIC_ID, requestId },
    );
  }

  private event(
    connection: SqlConnection,
    eventType: string,
    kind: string,
    id: string,
    payload: object,
  ) {
    return connection.execute(
      `INSERT INTO ${this.owner}.OUTBOX_EVENTS (SCOPE_KIND,AGGREGATE_TYPE,AGGREGATE_ID,EVENT_TYPE,PAYLOAD,AVAILABLE_AT_UTC,MAX_ATTEMPTS)
        VALUES ('PLATFORM',:kind,:id,:eventType,:payload,LOCALTIMESTAMP,:maxAttempts)`,
      {
        kind,
        id,
        eventType,
        payload: JSON.stringify(payload),
        maxAttempts: this.config.resetMaxAttempts,
      },
    );
  }
}
