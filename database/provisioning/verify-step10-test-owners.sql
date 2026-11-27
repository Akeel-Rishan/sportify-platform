-- Before first disposable suite run only. Installed test schemas are retained.
SET ECHO OFF
SET VERIFY OFF
SET DEFINE OFF
SET SERVEROUTPUT ON
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT FAILURE ROLLBACK
DECLARE
  found NUMBER;
  test_identity VARCHAR2(30);
BEGIN
  IF :expected_db_unique_name IS NULL OR :expected_db_unique_name<>'fce953xa'
    OR :expected_db_unique_name<>SYS_CONTEXT('USERENV','DB_UNIQUE_NAME')
    OR SYS_CONTEXT('USERENV','SESSION_USER')<>'ADMIN'
    OR :owner_quota_mb IS NULL OR :owner_quota_mb<>256 THEN
    RAISE_APPLICATION_ERROR(-20050,'STOP: verified target and ADMIN required.');
  END IF;
  FOR fixture_index IN 1..2 LOOP
    test_identity:=CASE fixture_index WHEN 1 THEN 'SPORTIFY_STEP10_CLEAN_OWNER' ELSE 'SPORTIFY_STEP10_UPGRADE_OWNER' END;
  SELECT COUNT(*) INTO found FROM DBA_USERS WHERE USERNAME=test_identity AND ACCOUNT_STATUS='OPEN' AND AUTHENTICATION_TYPE='PASSWORD';
  IF found<>1 THEN RAISE_APPLICATION_ERROR(-20051,'Test-owner authentication/status failed.'); END IF;
  SELECT COUNT(*) INTO found FROM DBA_SYS_PRIVS WHERE GRANTEE=test_identity;
  IF found<>3 THEN RAISE_APPLICATION_ERROR(-20052,'Unexpected test-owner system privileges.'); END IF;
  SELECT COUNT(*) INTO found FROM DBA_SYS_PRIVS WHERE GRANTEE=test_identity AND ADMIN_OPTION='NO' AND PRIVILEGE IN ('CREATE SESSION','CREATE TABLE','CREATE SEQUENCE');
  IF found<>3 THEN RAISE_APPLICATION_ERROR(-20053,'Missing or excessive test-owner system privileges.'); END IF;
  SELECT COUNT(*) INTO found FROM DBA_ROLE_PRIVS WHERE GRANTEE=test_identity;
  IF found<>0 THEN RAISE_APPLICATION_ERROR(-20054,'Unexpected test-owner roles.'); END IF;
  SELECT COUNT(*) INTO found FROM DBA_TAB_PRIVS WHERE GRANTEE=test_identity;
  IF found<>1 THEN RAISE_APPLICATION_ERROR(-20055,'Unexpected test-owner object grants.'); END IF;
  SELECT COUNT(*) INTO found FROM DBA_TAB_PRIVS WHERE GRANTEE=test_identity AND OWNER='SYS' AND TABLE_NAME='DBMS_LOCK' AND PRIVILEGE='EXECUTE' AND GRANTABLE='NO';
  IF found<>1 THEN RAISE_APPLICATION_ERROR(-20056,'Missing exact test-owner lock capability.'); END IF;
  SELECT COUNT(*) INTO found FROM DBA_COL_PRIVS WHERE GRANTEE=test_identity;
  IF found<>0 THEN RAISE_APPLICATION_ERROR(-20057,'Unexpected column grants.'); END IF;
  SELECT COUNT(*) INTO found FROM DBA_TS_QUOTAS WHERE USERNAME=test_identity AND TABLESPACE_NAME='DATA' AND MAX_BYTES=:owner_quota_mb*1024*1024;
  IF found<>1 THEN RAISE_APPLICATION_ERROR(-20058,'Test-owner finite quota mismatch.'); END IF;
  SELECT COUNT(*) INTO found FROM DBA_TS_QUOTAS WHERE USERNAME=test_identity AND TABLESPACE_NAME<>'DATA' AND MAX_BYTES<>0;
  IF found<>0 THEN RAISE_APPLICATION_ERROR(-20059,'Unexpected additional quota.'); END IF;
  SELECT COUNT(*) INTO found FROM DBA_OBJECTS WHERE OWNER=test_identity;
  IF found<>0 THEN RAISE_APPLICATION_ERROR(-20060,'Test owner must initially be genuinely empty; never clear it automatically.'); END IF;
  DBMS_OUTPUT.PUT_LINE('PASS: '||test_identity||' initial authentication, exact grants, quota and empty schema.');
  END LOOP;
END;
/
