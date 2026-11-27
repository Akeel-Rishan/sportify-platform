import assert from 'node:assert/strict';
import { parseMigrationConfig } from '@sportify/migrations';
import { EnvironmentError } from '@sportify/validation';
import { runtimeVerificationConfigs } from '../support/runtime-privileges.mjs';

export const TARGET = 'fce953xa';
export const CLEAN_OWNER = 'SPORTIFY_STEP10_CLEAN_OWNER';
export const UPGRADE_OWNER = 'SPORTIFY_STEP10_UPGRADE_OWNER';
export function assertDisposable(owner) {
  assert.ok([CLEAN_OWNER, UPGRADE_OWNER].includes(owner), 'Only exact Step 10 disposable owners.');
}
export function step10Configuration(environment, { owners = true } = {}) {
  assert.equal(environment.ORACLE_MIGRATION_CONFIRM, 'designated-development');
  assert.equal(environment.ORACLE_MIGRATION_DB_UNIQUE_NAME, TARGET);
  assert.equal(environment.ORACLE_MIGRATION_TEST_CONFIRM, 'isolated-disposable-empty');
  const runtimes = runtimeVerificationConfigs(environment);
  if (!owners) return { runtimes };
  const incompletePasswords = [
    ['ORACLE_MIGRATION_PASSWORD', CLEAN_OWNER],
    ['ORACLE_STEP10_UPGRADE_PASSWORD', UPGRADE_OWNER],
  ]
    .filter(([field]) => !environment[field])
    .map(([field, owner]) => `${field}: privately supply the password for ${owner}`);
  if (incompletePasswords.length) throw new EnvironmentError(incompletePasswords);
  const clean = parseMigrationConfig(environment);
  assert.equal(clean.ORACLE_MIGRATION_SCHEMA, CLEAN_OWNER);
  const upgrade = parseMigrationConfig({
    ...environment,
    ORACLE_MIGRATION_SCHEMA: UPGRADE_OWNER,
    ORACLE_MIGRATION_USER: UPGRADE_OWNER,
    ORACLE_MIGRATION_PASSWORD: environment.ORACLE_STEP10_UPGRADE_PASSWORD,
  });
  return { clean, upgrade, runtimes };
}
export async function verifyEmptyOwner(session, owner) {
  assertDisposable(owner);
  const rows = async (sql) => (await session.execute(sql, {}, { outFormat: 4002 })).rows ?? [];
  assert.equal(
    (await rows('SELECT OBJECT_NAME FROM USER_OBJECTS')).length,
    0,
    'Fresh empty owner required; no reset/adoption.',
  );
  assert.deepEqual(
    await rows('SELECT PRIVILEGE,ADMIN_OPTION FROM USER_SYS_PRIVS ORDER BY PRIVILEGE'),
    [
      { PRIVILEGE: 'CREATE SEQUENCE', ADMIN_OPTION: 'NO' },
      { PRIVILEGE: 'CREATE SESSION', ADMIN_OPTION: 'NO' },
      { PRIVILEGE: 'CREATE TABLE', ADMIN_OPTION: 'NO' },
    ],
  );
  assert.equal((await rows('SELECT GRANTED_ROLE FROM USER_ROLE_PRIVS')).length, 0);
  assert.deepEqual(
    await rows(
      'SELECT OWNER,TABLE_NAME,PRIVILEGE,GRANTABLE FROM USER_TAB_PRIVS WHERE GRANTEE=USER',
    ),
    [{ OWNER: 'SYS', TABLE_NAME: 'DBMS_LOCK', PRIVILEGE: 'EXECUTE', GRANTABLE: 'NO' }],
  );
  assert.equal((await rows('SELECT GRANTEE FROM USER_COL_PRIVS WHERE GRANTEE=USER')).length, 0);
  assert.deepEqual(
    await rows('SELECT TABLESPACE_NAME,MAX_BYTES FROM USER_TS_QUOTAS WHERE MAX_BYTES<>0'),
    [{ TABLESPACE_NAME: 'DATA', MAX_BYTES: 268435456 }],
  );
}
export function safeFailure(error) {
  return {
    oracle: Number.isInteger(error?.errorNum) ? error.errorNum : null,
    driver: /^(?:NJS|DPI)-\d+$/.test(error?.code ?? '') ? error.code : null,
    classification: [
      'unavailable',
      'scope_closed',
      'parallel_operation',
      'nested_scope',
      'temporal_projection_required',
      'invalid_bind',
    ].includes(error?.classification)
      ? error.classification
      : null,
  };
}
