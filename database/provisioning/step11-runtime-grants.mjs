const api = 'SPORTIFY_API';
const worker = 'SPORTIFY_WORKER';

export const registrationGrants = [
  [api, 'AUTH_SOURCE_WINDOWS', 'SELECT'],
  [api, 'AUTH_SOURCE_WINDOWS', 'INSERT'],
  [api, 'AUTH_SOURCE_WINDOWS', 'UPDATE', 'REQUEST_COUNT,WINDOW_END_UTC'],
  [api, 'USERS', 'SELECT'],
  [api, 'USERS', 'INSERT', 'PUBLIC_ID,FULL_NAME,EMAIL,EMAIL_NORMALIZED,MOBILE_E164,ACCOUNT_STATUS'],
  [
    api,
    'USERS',
    'UPDATE',
    'FULL_NAME,MOBILE_E164,PASSWORD_HASH,ACCOUNT_STATUS,EMAIL_VERIFIED_AT_UTC,UPDATED_AT_UTC',
  ],
  [api, 'EMAIL_VERIFICATION_TOKENS', 'SELECT'],
  [
    api,
    'EMAIL_VERIFICATION_TOKENS',
    'INSERT',
    'USER_ID,PUBLIC_ID,TOKEN_KEY_VERSION,TOKEN_HASH,EXPIRES_AT_UTC',
  ],
  [api, 'EMAIL_VERIFICATION_TOKENS', 'UPDATE', 'REVOKED_AT_UTC,CONSUMED_AT_UTC'],
  [api, 'TENANTS', 'READ'],
  [api, 'TENANTS', 'INSERT', 'PUBLIC_ID,TENANT_CODE,TENANT_NAME,STATUS'],
  [api, 'TENANT_USERS', 'READ'],
  [api, 'TENANT_USERS', 'INSERT', 'TENANT_ID,USER_ID,PUBLIC_ID,MEMBERSHIP_STATUS,JOINED_AT_UTC'],
  [api, 'ROLES', 'READ'],
  [api, 'ROLES', 'INSERT', 'TENANT_ID,ROLE_CODE,ROLE_NAME,IS_SYSTEM_ROLE,IS_ACTIVE'],
  [api, 'PERMISSIONS', 'READ'],
  [api, 'ROLE_PERMISSIONS', 'INSERT', 'TENANT_ID,ROLE_ID,PERMISSION_ID'],
  [api, 'USER_ROLES', 'INSERT', 'TENANT_ID,MEMBERSHIP_ID,ROLE_ID'],
  [
    api,
    'AUDIT_LOGS',
    'INSERT',
    'PUBLIC_ID,TENANT_ID,SCOPE_KIND,ACTOR_TYPE,ACTOR_USER_ID,ACTOR_MEMBERSHIP_ID,ACTOR_SERVICE,ACTION_CODE,ENTITY_TYPE,ENTITY_PUBLIC_ID,REQUEST_ID',
  ],
  [
    api,
    'OUTBOX_EVENTS',
    'INSERT',
    'SCOPE_KIND,AGGREGATE_TYPE,AGGREGATE_ID,EVENT_TYPE,PAYLOAD,AVAILABLE_AT_UTC,MAX_ATTEMPTS',
  ],
  [worker, 'VW_AUTH_VERIFICATION_MAIL', 'READ'],
];

export async function grantRegistration(session, owner, beforeGrant) {
  if (owner !== 'SPORTIFY_STEP11_TEST_OWNER') throw new Error('Disposable grant setup only.');
  for (const [grantee, object, privilege, columns] of registrationGrants) {
    beforeGrant?.(`grant-${grantee}-${object}-${privilege}`);
    await session.execute(
      `GRANT ${privilege}${columns ? ` (${columns})` : ''} ON ${owner}.${object} TO ${grantee}`,
    );
  }
}

export async function revokeDisposableRegistration(session, owner) {
  if (owner !== 'SPORTIFY_STEP11_TEST_OWNER') throw new Error('Disposable grant cleanup only.');
  for (const [grantee, object, privilege] of [...registrationGrants].reverse()) {
    try {
      await session.execute(`REVOKE ${privilege} ON ${owner}.${object} FROM ${grantee}`);
    } catch (error) {
      if (error?.errorNum !== 1927) throw error;
    }
  }
}
