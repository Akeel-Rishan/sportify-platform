# Account preparation operator runbook — Step 06

**ACCOUNT PROVISIONING NOT EXECUTED. Live gate BLOCKED: the user reports creating an Always Free development instance with required mTLS, but its exact target identity, protected wallet and secure runtime credentials remain unverified.** Local scripts are review artifacts, not provisioning evidence. Do not run the broad source bootstrap. No business objects belong in this step.

## Preconditions and target check

Use Oracle SQLcl **25.4**, Java 17 or 21, from a trusted working directory without unreviewed `login.sql`. SQLcl executes PL/SQL blocks natively; do not split scripts on semicolons. Have an authorized ATP administrator confirm the development/pilot resource, actual database release, `DB_UNIQUE_NAME`, permitted TLS mode, existing network access, password policy and a finite owner DATA quota. Do not change network rules here. Review [privileges](../../Docs/database/account-and-privilege-model.md) first. Scripts require the target's ADMIN session; that credential never enters API/worker configuration.

Start `sql /nolog`. Turn off terminal/session recording and spooling. Connect interactively with `CONNECT ADMIN@<securely configured client alias>` and enter the password only at the hidden prompt; do not include `/password` in any command, history, environment example or source file. Client aliases/wallets are operator-managed outside the checkout. SQLcl and the Node runtimes use the selected mTLS mode; see [protected instance-wallet setup](../../Docs/database/secure-connectivity.md#instance-wallet-setup). SQLcl uses its supported client alias/wallet configuration; the Node Thin pool uses PEM wallet material and option-free Easy Connect. Never use insecure certificate settings.

Inspect `SELECT SYS_CONTEXT('USERENV','DB_UNIQUE_NAME'), SYS_CONTEXT('USERENV','SESSION_USER') FROM DUAL;` against the authorized resource record. Define **nonsecret** bind variables in that same SQLcl session:

```sql
SET ECHO OFF
SET VERIFY OFF
SPOOL OFF
VARIABLE expected_db_unique_name VARCHAR2(128)
VARIABLE operator_confirmation VARCHAR2(32)
VARIABLE owner_quota_mb NUMBER
-- Replace only with the operator-reviewed target identifier and finite MB budget.
EXEC :expected_db_unique_name := '<designated database unique name>';
EXEC :operator_confirmation := 'DESIGNATED_DEVELOPMENT';
EXEC :owner_quota_mb := <approved integer MB, 1 through 10240>;
@database/provisioning/provision-accounts.sql
```

The placeholders deliberately are not runnable values. Paths assume SQLcl was launched in this repository. All accounts must be absent; DATA must exist; target, ADMIN, confirmation and quota must match before the first change. Scripts print the verified database identity/account and password-free milestones. They do not print endpoints or connection descriptors. They fail closed on existing accounts and SQL/OS errors. Earlier successful Oracle DDL remains committed after a later failure; `ROLLBACK` cannot undo it.

## Authentication and postconditions

Preparation creates `SPORTIFY_SCHEMA_OWNER`, `SPORTIFY_API` and `SPORTIFY_WORKER` with **NO AUTHENTICATION ACCOUNT LOCK**, then their minimal direct grants and finite owner quota. No reusable password is created by a script. After successful preparation, in the same verified ADMIN session, use SQLcl's hidden prompts:

```sql
PASSWORD SPORTIFY_SCHEMA_OWNER
PASSWORD SPORTIFY_API
PASSWORD SPORTIFY_WORKER
ALTER USER SPORTIFY_SCHEMA_OWNER ACCOUNT UNLOCK;
ALTER USER SPORTIFY_API ACCOUNT UNLOCK;
ALTER USER SPORTIFY_WORKER ACCOUNT UNLOCK;
@database/provisioning/verify-accounts.sql
```

Each PASSWORD command prompts for new/retyped passwords without echo. This enables password authentication on the schema-only account through ALTER USER semantics; target-specific SQLcl/ATP acceptance remains a **live verification prerequisite**, not a tested claim. Store each new credential directly in the approved secret mechanism. If a command fails, stop; keep the affected account locked and inspect state. Never substitute password-bearing DDL text or a chat message as a shortcut.

Verification requires all three accounts OPEN/PASSWORD, exactly the direct system privileges in the matrix, no roles/admin option/object or column grants, no runtime storage quota, the exact finite DATA owner quota and empty schemas. Review inherited PUBLIC rights separately with the ATP administrator; these scripts do not revoke platform defaults or claim a complete database security audit. Record sanitized postcondition results and actual client/database versions in the operator evidence record. Then run both [runtime identity verification tools](../../Docs/database/oracle-verification.md).

## Partial failure and rotation

If preparation fails, its SQLcl exit is FAILURE and prior DDL can remain. Reconnect to the same verified target and inspect DBA_USERS, DBA_SYS_PRIVS, DBA_ROLE_PRIVS and DBA_TS_QUOTAS for these three exact identities. Retain milestone output in restricted operator records. Do not rerun blindly, drop accounts, reset existing passwords or silently replace grants. An operator must approve a repair for the observed partial state, execute only reviewed missing operations and repeat every postcondition. An unexpected existing account might belong to another system; resolve ownership first.

For later rotation, explicitly authorize the identity/target, stop that application, use hidden PASSWORD prompts, update only its protected secret, recreate its process-local pool by restarting the process, verify readiness/connectivity and retire the old secret. Rotation does not update already-authenticated pooled sessions automatically. Owner rotation is an independent controlled migration operation. Do not run initial provisioning for rotation. No automation here resets an existing password.

## Official references consulted, 20 November 2026

- [ATP user creation and DATA quota](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/manage-users-create.html).
- [SQLcl 25.4 client prerequisites and SQL*Plus support](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/25.4/sqcug/working-sqlcl.html).
- [SQL*Plus PASSWORD hidden input](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqpug/SQL-Plus-command-reference.html).
- [Oracle 19c schema-only accounts and enabling authentication](https://docs.oracle.com/en/database/oracle/oracle-database/19/dbseg/schema-only-accounts.html).
- [CREATE TABLE / identity and schema prerequisites](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-TABLE.html), [CREATE SEQUENCE](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-SEQUENCE.html).
