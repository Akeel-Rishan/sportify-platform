-- D-31 application-owner grant only, after the verified seed-only recovery capture.
SET ECHO OFF
SET VERIFY OFF
SET DEFINE OFF
SET SERVEROUTPUT ON
SPOOL OFF
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT FAILURE ROLLBACK

DECLARE
  live_sessions NUMBER;
  enabled_jobs NUMBER;
  running_jobs NUMBER;
  legacy_jobs NUMBER;
  history_count NUMBER;
  valid_history_count NUMBER;
  view_count NUMBER;
  view_grant_count NUMBER;
  admin_option_count NUMBER;
BEGIN
  IF NVL(SYS_CONTEXT('USERENV','DB_UNIQUE_NAME'), '?') <> 'fce953xa'
     OR NVL(SYS_CONTEXT('USERENV','SESSION_USER'), '?') <> 'ADMIN'
     OR NVL(:operator_confirmation, '?') <> 'STEP11_DEV_MAINTENANCE' THEN
    RAISE_APPLICATION_ERROR(-20110, 'STOP: verified fce953xa ADMIN and maintenance confirmation required.');
  END IF;

  SELECT COUNT(*) INTO live_sessions FROM GV$SESSION WHERE TYPE = 'USER'
    AND CON_ID = TO_NUMBER(SYS_CONTEXT('USERENV','CON_ID'))
    AND USERNAME IN ('SPORTIFY_SCHEMA_OWNER', 'SPORTIFY_API', 'SPORTIFY_WORKER');
  SELECT COUNT(*) INTO enabled_jobs FROM DBA_SCHEDULER_JOBS WHERE ENABLED = 'TRUE'
    AND OWNER IN ('SPORTIFY_SCHEMA_OWNER', 'SPORTIFY_API', 'SPORTIFY_WORKER');
  SELECT COUNT(*) INTO running_jobs FROM DBA_SCHEDULER_RUNNING_JOBS
    WHERE OWNER IN ('SPORTIFY_SCHEMA_OWNER', 'SPORTIFY_API', 'SPORTIFY_WORKER');
  SELECT COUNT(*) INTO legacy_jobs FROM DBA_JOBS WHERE BROKEN = 'N'
    AND (SCHEMA_USER IN ('SPORTIFY_SCHEMA_OWNER', 'SPORTIFY_API', 'SPORTIFY_WORKER')
      OR PRIV_USER IN ('SPORTIFY_SCHEMA_OWNER', 'SPORTIFY_API', 'SPORTIFY_WORKER'));

  IF live_sessions + enabled_jobs + running_jobs + legacy_jobs <> 0 THEN
    DBMS_OUTPUT.PUT_LINE('Maintenance check: open sessions=' || live_sessions ||
      ', enabled scheduler jobs=' || enabled_jobs || ', running scheduler jobs=' || running_jobs ||
      ', active legacy jobs=' || legacy_jobs);
    RAISE_APPLICATION_ERROR(-20111, 'STOP: SPORTIFY application sessions or jobs remain.');
  END IF;

  SELECT COUNT(*), COUNT(CASE WHEN EXECUTION_STATUS = 'APPLIED' AND REPAIR_VERSION IS NULL
    AND REGEXP_LIKE(VERSION,'^0000(0[1-9]|1[0-9]|2[0-6])$') THEN 1 END)
    INTO history_count, valid_history_count FROM SPORTIFY_SCHEMA_OWNER.SCHEMA_MIGRATIONS;
  SELECT COUNT(*) INTO view_count FROM DBA_OBJECTS
    WHERE OWNER = 'SPORTIFY_SCHEMA_OWNER' AND OBJECT_NAME = 'VW_AUTH_VERIFICATION_MAIL';
  IF history_count <> 26 OR valid_history_count <> 26 OR view_count <> 0 THEN
    RAISE_APPLICATION_ERROR(-20112, 'STOP: the verified application migration baseline has changed.');
  END IF;

  SELECT COUNT(*), COUNT(CASE WHEN ADMIN_OPTION <> 'NO' THEN 1 END)
    INTO view_grant_count, admin_option_count FROM DBA_SYS_PRIVS
    WHERE GRANTEE = 'SPORTIFY_SCHEMA_OWNER' AND PRIVILEGE = 'CREATE VIEW';
  IF admin_option_count <> 0 OR view_grant_count > 1 THEN
    RAISE_APPLICATION_ERROR(-20113, 'STOP: unexpected existing CREATE VIEW grant.');
  END IF;
  IF view_grant_count = 0 THEN
    EXECUTE IMMEDIATE 'GRANT CREATE VIEW TO SPORTIFY_SCHEMA_OWNER';
  END IF;

  SELECT COUNT(*) INTO view_grant_count FROM DBA_SYS_PRIVS
    WHERE GRANTEE = 'SPORTIFY_SCHEMA_OWNER' AND PRIVILEGE = 'CREATE VIEW' AND ADMIN_OPTION = 'NO';
  IF view_grant_count <> 1 THEN
    RAISE_APPLICATION_ERROR(-20114, 'STOP: CREATE VIEW postcondition failed; inspect partial state.');
  END IF;
  DBMS_OUTPUT.PUT_LINE('PASS: fce953xa ADMIN, zero SPORTIFY sessions/jobs, 26 applied migrations, exact CREATE VIEW grant.');
END;
/
