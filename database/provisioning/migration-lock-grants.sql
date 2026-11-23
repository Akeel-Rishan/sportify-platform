-- Reviewed Step 07 owner-only capability. No runtime grants or broad roles.
SET ECHO OFF
SET VERIFY OFF
SET DEFINE OFF
SET SERVEROUTPUT ON
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT FAILURE ROLLBACK
DECLARE
  found NUMBER;
BEGIN
  IF :expected_db_unique_name IS NULL OR :expected_db_unique_name <> SYS_CONTEXT('USERENV','DB_UNIQUE_NAME')
    OR SYS_CONTEXT('USERENV','SESSION_USER') <> 'ADMIN'
    OR :operator_confirmation IS NULL OR :operator_confirmation <> 'MIGRATION_LOCK_ONLY' THEN
    RAISE_APPLICATION_ERROR(-20030,'STOP: designated development target/ADMIN/lock-only confirmation required.');
  END IF;
  SELECT COUNT(*) INTO found FROM DBA_USERS WHERE USERNAME='SPORTIFY_SCHEMA_OWNER' AND ORACLE_MAINTAINED='N';
  IF found<>1 THEN RAISE_APPLICATION_ERROR(-20031,'STOP: expected existing application owner required.'); END IF;
  SELECT COUNT(*) INTO found FROM DBA_TAB_PRIVS WHERE OWNER='SYS' AND TABLE_NAME='DBMS_LOCK'
    AND (GRANTEE IN ('SPORTIFY_API','SPORTIFY_WORKER') OR (GRANTEE='SPORTIFY_SCHEMA_OWNER' AND (PRIVILEGE<>'EXECUTE' OR GRANTABLE<>'NO')));
  IF found<>0 THEN RAISE_APPLICATION_ERROR(-20032,'STOP: unexpected lock grants; inspect instead of replacing.'); END IF;
  SELECT COUNT(*) INTO found FROM DBA_TAB_PRIVS WHERE OWNER='SYS' AND TABLE_NAME='DBMS_LOCK'
    AND GRANTEE='SPORTIFY_SCHEMA_OWNER' AND PRIVILEGE='EXECUTE' AND GRANTABLE='NO';
  IF found=0 THEN
    EXECUTE IMMEDIATE 'GRANT EXECUTE ON SYS.DBMS_LOCK TO SPORTIFY_SCHEMA_OWNER';
    DBMS_OUTPUT.PUT_LINE('Granted only SYS.DBMS_LOCK EXECUTE to the migration owner.');
  ELSIF found=1 THEN
    DBMS_OUTPUT.PUT_LINE('Exact owner lock grant already present; unchanged.');
  ELSE
    RAISE_APPLICATION_ERROR(-20033,'STOP: unexpected duplicate grant metadata.');
  END IF;
  DBMS_OUTPUT.PUT_LINE('Next run the owner lock capability check. No runtime or grant-option privilege was added.');
END;
/
