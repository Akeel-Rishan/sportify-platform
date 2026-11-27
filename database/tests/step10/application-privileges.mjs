import assert from 'node:assert/strict';
import { createDatabase } from '@sportify/database';
import { TARGET, safeFailure } from './config.mjs';

export async function verifyApplicationPrivileges(entries, record) {
  for (const entry of entries) {
    const database = await createDatabase(entry.config, entry.role);
    let failed = false;
    let step = 'identity';
    try {
      const context = (
        await database.query(
          "SELECT SYS_CONTEXT('USERENV','DB_UNIQUE_NAME') AS TARGET,SYS_CONTEXT('USERENV','SESSION_USER') AS IDENTITY FROM DUAL",
        )
      ).rows[0];
      assert.deepEqual(context, { TARGET, IDENTITY: entry.config.ORACLE_USER });
      assert.equal(await database.check(), true);
      step = 'system-privileges';
      assert.deepEqual((await database.query('SELECT PRIVILEGE FROM SESSION_PRIVS')).rows, [
        { PRIVILEGE: 'CREATE SESSION' },
      ]);
      assert.deepEqual(
        (await database.query('SELECT PRIVILEGE,ADMIN_OPTION FROM USER_SYS_PRIVS')).rows,
        [{ PRIVILEGE: 'CREATE SESSION', ADMIN_OPTION: 'NO' }],
      );
      for (const [name, query] of [
        ['roles', 'SELECT GRANTED_ROLE FROM USER_ROLE_PRIVS'],
        ['direct-object-grants', 'SELECT GRANTEE FROM USER_TAB_PRIVS WHERE GRANTEE=USER'],
        ['direct-column-grants', 'SELECT GRANTEE FROM USER_COL_PRIVS WHERE GRANTEE=USER'],
        ['owned-tables', 'SELECT TABLE_NAME FROM USER_TABLES'],
        ['quota', 'SELECT TABLESPACE_NAME FROM USER_TS_QUOTAS WHERE MAX_BYTES<>0'],
        [
          'application-public-grants',
          "SELECT GRANTEE FROM ALL_TAB_PRIVS WHERE TABLE_SCHEMA='SPORTIFY_SCHEMA_OWNER' AND GRANTEE='PUBLIC' AND TYPE<>'USER'",
        ],
      ]) {
        step = name;
        assert.deepEqual((await database.query(query)).rows, []);
      }
      const denied = [
        ['history-read', 'SELECT VERSION FROM SPORTIFY_SCHEMA_OWNER.SCHEMA_MIGRATIONS WHERE 1=0'],
        [
          'history-write',
          'UPDATE SPORTIFY_SCHEMA_OWNER.SCHEMA_MIGRATIONS SET DESCRIPTION=DESCRIPTION WHERE 1=0',
        ],
        [
          'audit-update',
          'UPDATE SPORTIFY_SCHEMA_OWNER.AUDIT_LOGS SET ACTION_CODE=ACTION_CODE WHERE 1=0',
        ],
        ['audit-delete', 'DELETE FROM SPORTIFY_SCHEMA_OWNER.AUDIT_LOGS WHERE 1=0'],
        ['unrelated-object-read', 'SELECT USER_ID FROM SPORTIFY_SCHEMA_OWNER.USERS WHERE 1=0'],
      ];
      for (const [name, sql] of denied) {
        step = name;
        await assert.rejects(database.query(sql), (error) => [942, 1031].includes(error.errorNum));
        assert.equal(await database.check(), true);
      }
      record('runtime.application-privileges', 'PASS', {
        role: entry.role,
        exactAccessDenials: denied.length,
      });
    } catch (error) {
      failed = true;
      record('runtime.application-privileges', 'FAIL', {
        role: entry.role,
        step,
        ...safeFailure(error),
      });
      throw error;
    } finally {
      await database.close().catch((error) => {
        record('runtime.privilege-pool-cleanup', 'FAIL', { role: entry.role });
        if (!failed) throw error;
      });
    }
  }
}
