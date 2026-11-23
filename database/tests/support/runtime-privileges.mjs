import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase, parseDatabaseConfig } from '@sportify/database';

export function runtimeVerificationConfigs(environment) {
  return ['api', 'worker'].map((role) => ({
    role,
    config: parseDatabaseConfig(
      {
        ...environment,
        ORACLE_USER: `SPORTIFY_${role.toUpperCase()}`,
        ORACLE_PASSWORD: environment[`ORACLE_${role.toUpperCase()}_PASSWORD`],
        ORACLE_POOL_MIN: '0',
        ORACLE_POOL_MAX: '1',
        ORACLE_POOL_INCREMENT: '1',
        ORACLE_QUEUE_TIMEOUT_MS: '5000',
        ORACLE_CALL_TIMEOUT_MS: '5000',
      },
      role,
    ),
  }));
}

export async function verifyRuntimePrivileges(entries, expectedTarget, owner) {
  assert.ok(['SPORTIFY_TEST_OWNER', 'SPORTIFY_STEP08_TEST_OWNER'].includes(owner));
  for (const entry of entries) {
    const database = await createDatabase(entry.config, entry.role);
    let cleanupFailed = false;
    try {
      const identity = (
        await database.query(
          "SELECT SYS_CONTEXT('USERENV','DB_UNIQUE_NAME') AS TARGET, SYS_CONTEXT('USERENV','SESSION_USER') AS IDENTITY FROM DUAL",
        )
      ).rows?.[0];
      assert.equal(identity?.TARGET, expectedTarget);
      assert.equal(identity?.IDENTITY, entry.config.ORACLE_USER);
      assert.equal(await database.check(), true);
      assert.deepEqual((await database.query('SELECT PRIVILEGE FROM SESSION_PRIVS')).rows, [
        { PRIVILEGE: 'CREATE SESSION' },
      ]);
      assert.equal(
        (await database.query('SELECT GRANTED_ROLE FROM USER_ROLE_PRIVS')).rows?.length,
        0,
      );
      assert.equal(
        (
          await database.query('SELECT GRANTEE FROM USER_TAB_PRIVS WHERE GRANTEE=:identity', {
            identity: entry.config.ORACLE_USER,
          })
        ).rows?.length,
        0,
      );
      assert.equal(
        (
          await database.query(
            "SELECT GRANTEE FROM ALL_TAB_PRIVS WHERE (TABLE_SCHEMA=:owner OR TABLE_SCHEMA='SPORTIFY_SCHEMA_OWNER') AND GRANTEE='PUBLIC' AND TYPE<>'USER'",
            { owner },
          )
        ).rows?.length,
        0,
      );
      async function denied(sql) {
        let caught;
        try {
          await database.query(sql);
        } catch (error) {
          caught = error;
        }
        assert.ok(
          [942, 1031].includes(caught?.errorNum),
          'Expected ORA-00942/01031 access denial after a verified successful connection.',
        );
        assert.equal(await database.check(), true);
      }
      // WHERE 1=0 prevents data mutation even if an unexpected grant exists.
      await denied(`UPDATE ${owner}.SCHEMA_MIGRATIONS SET DESCRIPTION=DESCRIPTION WHERE 1=0`);
      await denied(`SELECT VERSION FROM ${owner}.SCHEMA_MIGRATIONS WHERE 1=0`);
      // Only the expressly disposable owner is named, never a runtime schema or
      // application owner. Unexpected success leaves a named test-only column
      // for operator reconciliation rather than dropping any existing object.
      const column = 'S7_DENY_' + randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
      await denied(`ALTER TABLE ${owner}.SCHEMA_MIGRATIONS ADD (${column} NUMBER)`);
    } finally {
      try {
        await database.close();
      } catch {
        cleanupFailed = true;
        console.error('Runtime verification pool cleanup failed; raw diagnostics suppressed.');
      }
    }
    if (cleanupFailed) throw new Error('Runtime verification pool cleanup failed.');
    console.info(
      `PASS ${entry.role}: real identity/target, positive DUAL probe, CREATE SESSION only, migration-history read/write and disposable-owner DDL denied with exact Oracle access codes; connection reuse passed.`,
    );
  }
}
