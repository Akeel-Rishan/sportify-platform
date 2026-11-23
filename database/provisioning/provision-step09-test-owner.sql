-- Explicit disposable Step 09 test owner. Never drop/recreate an existing user.
SET ECHO OFF
SET VERIFY OFF
SET DEFINE OFF
SET SERVEROUTPUT ON
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT FAILURE ROLLBACK
DECLARE
  found NUMBER;
BEGIN
  IF :expected_db_unique_name IS NULL OR :expected_db_unique_name<>SYS_CONTEXT('USERENV','DB_UNIQUE_NAME')
    OR SYS_CONTEXT('USERENV','SESSION_USER')<>'ADMIN'
    OR :operator_confirmation IS NULL OR :operator_confirmation<>'DISPOSABLE_STEP09_OWNER' THEN
    RAISE_APPLICATION_ERROR(-20040,'STOP: designated target/ADMIN/disposable test-owner confirmation required.');
  END IF;
  IF :owner_quota_mb IS NULL OR :owner_quota_mb<>TRUNC(:owner_quota_mb) OR :owner_quota_mb<1 OR :owner_quota_mb>10240 THEN
    RAISE_APPLICATION_ERROR(-20041,'STOP: reviewed finite DATA quota in MB required.');
  END IF;
  SELECT COUNT(*) INTO found FROM DBA_USERS WHERE USERNAME='SPORTIFY_STEP09_TEST_OWNER';
  IF found<>0 THEN RAISE_APPLICATION_ERROR(-20042,'STOP: test owner already exists; no automatic reuse or recreation.'); END IF;
  SELECT COUNT(*) INTO found FROM DBA_TABLESPACES WHERE TABLESPACE_NAME='DATA';
  IF found<>1 THEN RAISE_APPLICATION_ERROR(-20043,'STOP: DATA tablespace missing.'); END IF;
  DBMS_OUTPUT.PUT_LINE('Verified target='||SYS_CONTEXT('USERENV','DB_UNIQUE_NAME')||'; executing account='||SYS_CONTEXT('USERENV','SESSION_USER'));
  EXECUTE IMMEDIATE 'CREATE USER SPORTIFY_STEP09_TEST_OWNER NO AUTHENTICATION DEFAULT TABLESPACE DATA ACCOUNT LOCK';
  DBMS_OUTPUT.PUT_LINE('Created locked disposable test owner without password authentication.');
  EXECUTE IMMEDIATE 'ALTER USER SPORTIFY_STEP09_TEST_OWNER QUOTA '||TO_CHAR(:owner_quota_mb,'FM99999990')||'M ON DATA';
  EXECUTE IMMEDIATE 'GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE TO SPORTIFY_STEP09_TEST_OWNER';
  EXECUTE IMMEDIATE 'GRANT EXECUTE ON SYS.DBMS_LOCK TO SPORTIFY_STEP09_TEST_OWNER';
  DBMS_OUTPUT.PUT_LINE('Preparation complete. Set the initial password/unlock privately in Database Actions, then verify test-owner postconditions.');
EXCEPTION WHEN OTHERS THEN
  DBMS_OUTPUT.PUT_LINE('STOP: prior DDL may be committed; retain partial state and inspect before any recovery.');
  RAISE;
END;
/
