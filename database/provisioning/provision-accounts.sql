-- SQLcl 25.4. Password-free preparation. Read README before executing.
SET ECHO OFF
SET VERIFY OFF
SET DEFINE OFF
SET SERVEROUTPUT ON
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT FAILURE ROLLBACK

DECLARE
  found NUMBER;
  target VARCHAR2(128) := SYS_CONTEXT('USERENV', 'DB_UNIQUE_NAME');
  actor VARCHAR2(128) := SYS_CONTEXT('USERENV', 'SESSION_USER');
BEGIN
  IF :expected_db_unique_name IS NULL OR :expected_db_unique_name <> target
    OR :operator_confirmation IS NULL OR :operator_confirmation <> 'DESIGNATED_DEVELOPMENT'
    OR actor <> 'ADMIN' THEN
    RAISE_APPLICATION_ERROR(-20001, 'STOP: designated target/ADMIN/operator confirmation required.');
  END IF;
  DBMS_OUTPUT.PUT_LINE('Verified target=' || target || '; executing account=' || actor);
  IF :owner_quota_mb IS NULL OR :owner_quota_mb <> TRUNC(:owner_quota_mb)
    OR :owner_quota_mb < 1 OR :owner_quota_mb > 10240 THEN
    RAISE_APPLICATION_ERROR(-20002, 'STOP: approve a finite DATA quota, integer MB from 1 through 10240.');
  END IF;
  SELECT COUNT(*) INTO found FROM DBA_USERS
    WHERE USERNAME IN ('SPORTIFY_SCHEMA_OWNER', 'SPORTIFY_API', 'SPORTIFY_WORKER');
  IF found <> 0 THEN
    RAISE_APPLICATION_ERROR(-20003, 'STOP: an expected account already exists; inspect partial state. No automatic repair.');
  END IF;
  SELECT COUNT(*) INTO found FROM DBA_TABLESPACES WHERE TABLESPACE_NAME = 'DATA';
  IF found <> 1 THEN RAISE_APPLICATION_ERROR(-20004, 'STOP: required DATA tablespace not found.'); END IF;
  -- Every precondition precedes the first DDL. Subsequent DDL is NOT atomic.
  EXECUTE IMMEDIATE 'CREATE USER SPORTIFY_SCHEMA_OWNER NO AUTHENTICATION DEFAULT TABLESPACE DATA ACCOUNT LOCK';
  DBMS_OUTPUT.PUT_LINE('Created locked schema-owner account without a password.');
  EXECUTE IMMEDIATE 'ALTER USER SPORTIFY_SCHEMA_OWNER QUOTA ' || TO_CHAR(:owner_quota_mb, 'FM99999990') || 'M ON DATA';
  EXECUTE IMMEDIATE 'GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE TO SPORTIFY_SCHEMA_OWNER';
  EXECUTE IMMEDIATE 'CREATE USER SPORTIFY_API NO AUTHENTICATION DEFAULT TABLESPACE DATA ACCOUNT LOCK';
  DBMS_OUTPUT.PUT_LINE('Created locked API account without a password.');
  EXECUTE IMMEDIATE 'GRANT CREATE SESSION TO SPORTIFY_API';
  EXECUTE IMMEDIATE 'CREATE USER SPORTIFY_WORKER NO AUTHENTICATION DEFAULT TABLESPACE DATA ACCOUNT LOCK';
  DBMS_OUTPUT.PUT_LINE('Created locked worker account without a password.');
  EXECUTE IMMEDIATE 'GRANT CREATE SESSION TO SPORTIFY_WORKER';
  DBMS_OUTPUT.PUT_LINE('Account preparation complete. Authentication/unlock/postconditions still required; see runbook.');
EXCEPTION WHEN OTHERS THEN
  DBMS_OUTPUT.PUT_LINE('STOP: preparation failed; earlier DDL may be committed. Inspect catalogs before any recovery.');
  RAISE;
END;
/
