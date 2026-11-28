-- Read-only D-34 maintenance gate. Run before opening an application-owner session.
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
  applied_count NUMBER;
  view_count NUMBER;
BEGIN
  IF NVL(SYS_CONTEXT('USERENV','DB_UNIQUE_NAME'), '?') <> 'fce953xa'
     OR NVL(SYS_CONTEXT('USERENV','SESSION_USER'), '?') <> 'ADMIN'
     OR NVL(:operator_confirmation, '?') <> 'STEP12_DEV_MAINTENANCE' THEN
    RAISE_APPLICATION_ERROR(-20120, 'STOP: verified fce953xa ADMIN and Step 12 maintenance confirmation required.');
  END IF;

  SELECT COUNT(*) INTO live_sessions FROM GV$SESSION
    WHERE TYPE = 'USER' AND CON_ID = TO_NUMBER(SYS_CONTEXT('USERENV','CON_ID'))
      AND USERNAME IN ('SPORTIFY_SCHEMA_OWNER', 'SPORTIFY_API', 'SPORTIFY_WORKER');
  SELECT COUNT(*) INTO enabled_jobs FROM DBA_SCHEDULER_JOBS
    WHERE ENABLED = 'TRUE' AND OWNER IN ('SPORTIFY_SCHEMA_OWNER', 'SPORTIFY_API', 'SPORTIFY_WORKER');
  SELECT COUNT(*) INTO running_jobs FROM DBA_SCHEDULER_RUNNING_JOBS
    WHERE OWNER IN ('SPORTIFY_SCHEMA_OWNER', 'SPORTIFY_API', 'SPORTIFY_WORKER');
  SELECT COUNT(*) INTO legacy_jobs FROM DBA_JOBS WHERE BROKEN = 'N'
    AND (SCHEMA_USER IN ('SPORTIFY_SCHEMA_OWNER', 'SPORTIFY_API', 'SPORTIFY_WORKER')
      OR PRIV_USER IN ('SPORTIFY_SCHEMA_OWNER', 'SPORTIFY_API', 'SPORTIFY_WORKER'));

  IF live_sessions + enabled_jobs + running_jobs + legacy_jobs <> 0 THEN
    DBMS_OUTPUT.PUT_LINE('Maintenance check: open sessions=' || live_sessions ||
      ', enabled scheduler jobs=' || enabled_jobs || ', running scheduler jobs=' || running_jobs ||
      ', active legacy jobs=' || legacy_jobs);
    RAISE_APPLICATION_ERROR(-20121, 'STOP: SPORTIFY application sessions or jobs remain.');
  END IF;

  SELECT COUNT(*), COUNT(CASE WHEN EXECUTION_STATUS = 'APPLIED' AND REPAIR_VERSION IS NULL
    AND REGEXP_LIKE(VERSION, '^0000(0[1-9]|1[0-9]|2[0-7])$') THEN 1 END)
    INTO history_count, applied_count FROM SPORTIFY_SCHEMA_OWNER.SCHEMA_MIGRATIONS;
  SELECT COUNT(*) INTO view_count FROM DBA_OBJECTS
    WHERE OWNER = 'SPORTIFY_SCHEMA_OWNER'
      AND OBJECT_NAME IN ('VW_AUTH_DASHBOARD_SESSIONS', 'VW_AUTH_SESSION_REVOCATION', 'VW_AUTH_PASSWORD_RESET_MAIL');
  IF history_count <> 27 OR applied_count <> 27 OR view_count <> 0 THEN
    RAISE_APPLICATION_ERROR(-20122, 'STOP: the 27-migration application baseline has changed.');
  END IF;
  DBMS_OUTPUT.PUT_LINE('PASS: fce953xa ADMIN, zero SPORTIFY sessions/jobs, 27 applied migrations, Step 12 maintenance.');
END;
/
