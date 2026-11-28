# Step 11 development integration

**Development integration passed on 28 November 2026.** The controlled run applied `000027` and the 21 reviewed runtime grants to `SPORTIFY_SCHEMA_OWNER` on development ATP `fce953xa`. Public registration remains disabled. [Owner approval](../planning/decision-register.md#d-31--step-11-final-approval-and-development-integration-authorization) · [Verification results](#integration-checkpoint)

## Catalog change

| Object                      | Migration `000027` change                                                                                                                                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TENANTS`                   | Adds `PENDING_ONBOARDING` to `CK_TENANTS_STATUS`. Creates the wider validated check before dropping and renaming the prior check. The default stays `TRIAL`; registration explicitly inserts `PENDING_ONBOARDING`.                                                                             |
| `USERS`                     | Adds `CK_USERS_FINAL_PASSWORD` before making `PASSWORD_HASH` nullable. Only a `PENDING` account can have a null credential. Existing credentials are preserved.                                                                                                                                |
| `AUTH_SOURCE_WINDOWS`       | Adds a keyed source rate-window table with four columns. `PK_AUTH_SOURCE_WINDOWS` keys `SOURCE_HASH` and `ACTION_SCOPE`. `CK_AUTH_SOURCE_HASH`, `CK_AUTH_SOURCE_SCOPE` and `CK_AUTH_SOURCE_COUNT` check digest shape, scope and positive count. `IX_AUTH_SOURCE_EXPIRY` supports expiry scans. |
| `EMAIL_VERIFICATION_TOKENS` | Adds `IX_EMAIL_VERIFY_ISSUANCE` on `(USER_ID, CREATED_AT_UTC)` for cooldown and rolling limits.                                                                                                                                                                                                |
| `VW_AUTH_VERIFICATION_MAIL` | Adds a read-only view that exposes the minimum delivery fields for eligible pending and unexpired tokens. Its owner must have `CREATE VIEW`.                                                                                                                                                   |

Before integration, read-only application preflight measured 49 tables, 569 table columns, 463 named constraints and 26 `APPLIED` entries. The application owner had zero users or tenants and lacked direct `CREATE VIEW`. The disposable schema had already applied all 27 migrations and verified the new catalog. The controlled application upgrade reproduced that catalog. [Migration SQL](../../database/migrations/000027_owner_registration) · [Oracle CREATE VIEW privileges](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/CREATE-VIEW.html)

## Preconditions and controlled sequence

1. Obtain explicit authorization for the target, application migration, and exact grants. Confirm the current approval and isolated verification. Identify the operator and authorized maintenance window. Stop application writes during DDL, keep public registration disabled, and confirm a usable development recovery option. Record the application owner's existing grant baselines and aggregate row counts for `USERS` and `TENANTS` with no customer data or hashes in the evidence.
2. Build the reviewed release. Use the existing protected **application-owner** environment file for the baseline, status and later migration. Verify the target and session identity against the expected application schema as the runner already requires. Check the old catalog and checksums with `--baseline`. The full status command must show versions `000001`–`000026` applied, no repair or failed/running entries, and `000027` as the only pending migration. Verify that no unexpected objects or grants exist and no nonpending account has a null password. A different baseline needs review before mutation.

   ```powershell
   npx --yes pnpm@10.34.9 build
   node --env-file=database/provisioning/migrations.env database/tests/oracle-step10.mjs --baseline
   node --env-file=database/provisioning/migrations.env infra/scripts/database-status.mjs
   ```

3. After the local writer inspection and recovery capture, use the guarded grant script in a private SQLcl ADMIN session. Keep other SPORTIFY terminals and services paused through the postchecks. The script checks the target, operator, application sessions and jobs, existing ledger and absence of the new view before issuing the direct grant. The operator returns its PASS line or the STOP/Oracle error code. [Guarded grant](../../database/provisioning/grant-step11-development-create-view.sql)

   ```powershell
   Set-Location -LiteralPath "$env:USERPROFILE/.sportify-secrets/sqlcl-current"
   & 'C:/sqlcl/bin/sql.exe' /nolog
   ```

   ```sql
   SET CLOUDCONFIG Wallet_SPORTIFYDEV.zip
   CONNECT ADMIN@sportifydev_low
   ```

   Enter the ADMIN password at its private prompt. After SQLcl displays `Connected.`, run the following in the same session.

   ```sql
   VARIABLE operator_confirmation VARCHAR2(32)
   EXEC :operator_confirmation := 'STEP11_DEV_MAINTENANCE';
   @"C:/Users/ROG STRIX G15/Desktop/sportify-platform/database/provisioning/grant-step11-development-create-view.sql"
   ```

4. Run the migration and verification as `SPORTIFY_SCHEMA_OWNER` using its existing restricted credentials. Expect exactly `000027` applied, a clean exact catalog, and an empty apply list on a second migration command. Record the sanitized plan, status and verification result. The runner uses its advisory lock, validating the earlier catalog before mutation and the new catalog before marking the version applied.

   ```powershell
   node --env-file=database/provisioning/migrations.env infra/scripts/database-lock-check.mjs
   node --env-file=database/provisioning/migrations.env infra/scripts/database-migrate.mjs
   node --env-file=database/provisioning/migrations.env infra/scripts/database-verify.mjs
   node --env-file=database/provisioning/migrations.env infra/scripts/database-migrate.mjs
   node --env-file=database/provisioning/migrations.env infra/scripts/database-status.mjs
   ```

5. Review the application-qualified SQL from the [tested grant matrix](../../database/provisioning/step11-runtime-grants.mjs). The following command prints SQL for review and makes no database connection. Compare it with the grant inventory, then apply only those explicitly approved statements from a verified `SPORTIFY_SCHEMA_OWNER` session on `fce953xa`. Use stop-on-error client settings and capture sanitized progress per statement. The API receives exact table `SELECT`/`READ`, `INSERT` and column-restricted `INSERT`/`UPDATE` as listed. It gets insert-only audit and outbox access. Worker gets `READ` on `VW_AUTH_VERIFICATION_MAIL` only. The matrix has 21 statements, yielding 9 table/view privilege entries and 59 column privilege entries.

   ```powershell
   @'
   import { registrationGrants } from './database/provisioning/step11-runtime-grants.mjs';
   for (const [grantee, object, privilege, columns] of registrationGrants) {
     const columnList = columns ? ` (${columns})` : '';
     console.log(`GRANT ${privilege}${columnList} ON SPORTIFY_SCHEMA_OWNER.${object} TO ${grantee};`);
   }
   '@ | node --input-type=module
   ```

6. Compare `USER_TAB_PRIVS_MADE` and `USER_COL_PRIVS_MADE` with the reviewed matrix for both runtime accounts, including each object, privilege, column, and grantee. Check `GRANTABLE='NO'`, no Step 11 `PUBLIC` grants, no extra runtime system privileges, a `VALID` read-only view and the expected 50-table catalog. Recount `USERS` and `TENANTS` against the captured values. As API and worker, verify the exact account and target and use read-only probes for allowed and denied objects. Separately approve any synthetic write-and-cleanup test against the application schema. Keep registration disabled until the dispatcher, provider, configuration, ARM64 and deployed smoke gates pass. [Delivery acceptance gates](email-verification.md#delivery-and-deployment-acceptance)

## Forward recovery

- On a DDL failure, stop before applying grants. Oracle DDL commits independently, so compare the actual partial `USER_*` catalog to each reviewed statement and preserve the `RUNNING` or `FAILED` ledger, checksums and operator trace. The validated tenant check may already be installed under either name. Preserve the active check and the password invariant while reconciling the partial state. An approved, numbered forward fix must reference the failed entry and run under the same advisory lock with exact partial and final postconditions. Preserve failed history and link the verified repair. [Migration recovery](../database/migration-guide.md#verification-and-forward-fix-recovery) · [Oracle DDL transaction behavior](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/sql-language-reference.pdf)
- If schema verification succeeds but grant application fails, keep the routes disabled and compare the actual grant delta to the captured baseline. Review and finish the missing statements or revoke just the newly applied grants. The successful migration remains applied after grant rollback.
- If an approved runtime rollout later fails, remove traffic from the registration routes and restore the compatible application configuration. Preserve verified accounts, tokens, outbox intent and migrated schema. Use a separately approved forward fix, or reviewed restore if a forward fix is unsuitable. Replaying migration `000027` will only be a no-op once its verified ledger entry is `APPLIED`.

## Seed-only rebuild fallback

The owner accepted a verified rebuild of the 26-migration development baseline as a fallback. Prefer forward recovery. Before any destructive action, recheck the full data inventory and obtain separate explicit approval for the target and operation. Preserve the disposable owners and their test history. A clean install recreates the catalog, logical history and seed values with new ledger timestamps and generated IDs. Keep the original ledger and seed identities in the protected archive and compare seeds by stable codes.

1. Verify the protected archive checksum. Retain the original ledger and Step 10 live evidence and compare any partial migration and grant state to the capture.
2. In a separate checkout of `dbf32510a1c64369136715e794a26518186fd11e`, verify the 26 manifest entries and 239 SQL and seed files. Build the pinned release and use protected configuration for a separately approved empty target. Reproduce the original accounts and finite DATA quota. Supply initial credentials privately and grant direct `SYS.DBMS_LOCK` execution to the owner only. Verify the three original owner system privileges, both runtime accounts with `CREATE SESSION` only, and zero application object or column grants to either runtime. [Account setup](../database/account-and-privilege-model.md) · [Provision](../../database/provisioning/provision-accounts.sql) · [Verify](../../database/provisioning/verify-accounts.sql) · [Lock grant](../../database/provisioning/migration-lock-grants.sql)
3. With registration disabled, run the checkpoint's compiled lock check, migrate, verify, migrate again and status commands. Require exactly `000001` through `000026` on the first apply and a no-op repeat. Run the checkpoint's `oracle-step10.mjs --baseline` using the protected owner configuration. Require the exact 49-table catalog, matching checksums and zero repair or pending entries. [Migration commands](../database/migration-guide.md) · [Executed Step 10 clean install](../database/verification-report.md)
4. Reconcile all aggregate counts and the 8 sports and 20 permissions by natural key and field values against the archive. Reconfirm zero business data, the original runtime privileges and disabled registration before releasing maintenance.

## Integration checkpoint

28 November 2026. **Controlled development integration and verification passed.** The owner authorized the maintenance window and accepted the verified seed-only fallback. The operator's SQLcl transcript reported `fce953xa`, `ADMIN`, zero SPORTIFY sessions and jobs, 26 applied migrations and the exact direct `CREATE VIEW` grant. The subsequent local writer recheck passed.

- Read-only Oracle preflight verified `fce953xa` and `SPORTIFY_SCHEMA_OWNER`, all 26 `APPLIED` versions with their checksums, the exact 49-table catalog, and `000027` as the only pending migration. It recorded all 49 aggregate row counts. The 26-row migration ledger and 8 sports and 20 permission seeds were the only populated tables. All 239 original SQL and seed files matched the Git baseline byte for byte. The preflight evidence and changed-source scan found zero configured secret matches.
- The owner retained its three baseline system privileges and direct `EXECUTE` on `SYS.DBMS_LOCK`. Its new `CREATE VIEW` grant has no admin option. Oracle's original `PUBLIC` `INHERIT PRIVILEGES` entry on the `USER` remained intact. The application tables and views had zero outgoing grants at the preflight. [Oracle user-account grant behavior](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbseg/controlling-invokers-rights-privileges-procedure-calls-and-view-access.html)
- The local inspection found no matching processes, services or enabled scheduled tasks. The local Docker engine was stopped. ADMIN verified zero active or idle sessions and enabled or running jobs for the application owner, API and worker. The application owner independently verified zero enabled jobs in its schema. [Oracle activity monitoring](https://docs.oracle.com/en/database/oracle/oracle-database/26/admin/monitoring-the-database.html)
- A read-only transaction compared the reference seed fields to the original SQL. It captured the original ledger, counts, seed IDs, owner grants and Step 10 evidence outside the checkout in `.sportify-secrets/step11-dev-recovery-baseline-20261128053503513.json`. The archive round-trip and SHA-256 `fe0452df2831beb47d99eaf40310c2af15dd082cfd1a374bf39188a35e73f48a` were verified. The Step 10 clean install and upgrade establish that the preserved baseline ran on Oracle. No rebuild was performed.

| Check                         | Observed result                                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apply and replay              | Applied only `000027_owner_registration`. The catalog verifier passed and the second run returned an empty apply list. There are 27 `APPLIED` rows, no pending version and no failures or repairs.                                                                  |
| Exact catalog                 | 50 tables, 573 table columns and 468 named constraints. `IX_AUTH_SOURCE_EXPIRY` and `IX_EMAIL_VERIFY_ISSUANCE` are valid. `VW_AUTH_VERIFICATION_MAIL` is the sole view and is valid and read-only. No unexpected schema objects were found.                         |
| History and data preservation | All 26 prior ledger rows matched the private archive, including checksums and timestamps. All 49 prior table counts matched except for the new ledger row. All 8 sports and 20 permissions retained their IDs and field values. The new rate-limit table was empty. |
| Exact grants                  | All 21 statements succeeded. Owner and runtime metadata agreed on 9 table or view privileges and 59 column privileges. No extra grants or grant options were present. Each runtime had only `CREATE SESSION` and no roles.                                          |
| API read-only tests           | Verified the connection identity and target, 7 allowed reads and 7 exact access denials, including audit, outbox and migration history. The pool closed.                                                                                                            |
| Worker read-only tests        | Verified the connection identity and target, the allowed mail view read and 8 exact access denials, including the base user and token tables. The pool closed.                                                                                                      |

The first local grant preflight rejected the approved column name `MOBILE_E164` because its identifier check excluded digits. The corrected check passed against the unchanged SQL matrix before any grants ran. After all 21 grants passed owner metadata inspection, the first API assertion compared an Oracle decimal-string count to a JavaScript number. A read-only continuation verified both accounts using the documented string representation and performed no grant replay. [Number fetch contract](../database/connection-pooling.md)

The final source audit scanned 62 changed files and found zero configured-secret matches or private-file candidates. It reconfirmed the unchanged Git revision, all 26 original manifest entries and the byte hashes of their 239 SQL and seed artifacts. Documentation formatting and `git diff --check` passed.

Public registration stayed disabled. The maintenance run used no synthetic application writes, and no rebuild was performed. External dispatch, provider acceptance, inbox verification and deployment retain their own gates. Step 12 remains unstarted. [Delivery acceptance criteria](email-verification.md#delivery-and-deployment-acceptance)
