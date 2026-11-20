import {
  verificationEnvironment,
  withVerifiedTarget,
  requireCondition,
  reportFailure,
} from './oracle-verification-support.mjs';

try {
  for (const entry of verificationEnvironment()) {
    await withVerifiedTarget(entry, async (database) => {
      const privileges = (await database.query('SELECT PRIVILEGE FROM SESSION_PRIVS')).rows ?? [];
      requireCondition(privileges.length === 1 && privileges[0].PRIVILEGE === 'CREATE SESSION');
      requireCondition(
        ((await database.query('SELECT GRANTED_ROLE FROM USER_ROLE_PRIVS')).rows ?? []).length ===
          0,
      );
      requireCondition(
        (
          (await database.query("SELECT PRIVILEGE FROM USER_SYS_PRIVS WHERE ADMIN_OPTION = 'YES'"))
            .rows ?? []
        ).length === 0,
      );
      requireCondition(
        (
          (
            await database.query('SELECT GRANTEE FROM USER_COL_PRIVS WHERE GRANTEE = :identity', {
              identity: entry.config.ORACLE_USER,
            })
          ).rows ?? []
        ).length === 0,
      );
      requireCondition(
        (
          (
            await database.query('SELECT GRANTEE FROM USER_TAB_PRIVS WHERE GRANTEE = :identity', {
              identity: entry.config.ORACLE_USER,
            })
          ).rows ?? []
        ).length === 0,
      );
      requireCondition(
        ((await database.query('SELECT TABLE_NAME FROM USER_TABLES')).rows ?? []).length === 0,
      );
      requireCondition(
        (
          (await database.query('SELECT MAX_BYTES FROM USER_TS_QUOTAS WHERE MAX_BYTES <> 0'))
            .rows ?? []
        ).length === 0,
      );
      console.info(
        `PASS ${entry.role}: CREATE SESSION only, no roles/admin option/direct object grants/owned tables/storage quota. PUBLIC grants require the separate administrator catalog review.`,
      );
    });
  }
} catch (error) {
  reportFailure(error);
}
