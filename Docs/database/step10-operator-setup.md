# Step 10 isolated verification prerequisites

Both owners passed the ADMIN checks and authenticated from the protected environment file. The clean installation and verified continuation completed the Step 10 gate on 27 November 2026. The two used owners retain recorded history for review. The commands below document the setup and run.

The existing application owner and Step 07/08/09 test owners are preserved. Clean installation and independent prefix-to-current upgrade rehearsal require two fresh allowlisted identities: SPORTIFY_STEP10_CLEAN_OWNER and SPORTIFY_STEP10_UPGRADE_OWNER. Never drop/recreate a used owner or reset an existing password.

The designated development target remains fce953xa, with previously observed COMPATIBLE=23.5.0. In the current protected-wallet SQLcl directory, connect ADMIN privately and confirm the target:

```powershell
Set-Location -LiteralPath 'C:/Users/ROG STRIX G15/.sportify-secrets/sqlcl-current'
& 'C:/sqlcl/bin/sql.exe' /nolog
```

```sql
SET ECHO OFF
SET VERIFY OFF
SPOOL OFF
SET CLOUDCONFIG Wallet_SPORTIFYDEV.zip
CONNECT ADMIN@sportifydev_low
SELECT SYS_CONTEXT('USERENV','DB_UNIQUE_NAME') AS TARGET,
       SYS_CONTEXT('USERENV','SESSION_USER') AS IDENTITY FROM DUAL;
VARIABLE expected_db_unique_name VARCHAR2(128)
VARIABLE operator_confirmation VARCHAR2(32)
VARIABLE owner_quota_mb NUMBER
EXEC :expected_db_unique_name := 'fce953xa';
EXEC :operator_confirmation := 'DISPOSABLE_STEP10_OWNERS';
EXEC :owner_quota_mb := 256;
@"C:/Users/ROG STRIX G15/Desktop/sportify-platform/database/provisioning/provision-step10-test-owners.sql"
```

Only on the matching target/ADMIN does preparation create both accounts locked without authentication, with finite DATA quota and only CREATE SESSION/TABLE/SEQUENCE plus SYS.DBMS_LOCK EXECUTE without admin/grant option. It refuses if either account exists. DDL is non-atomic: stop and report partial completion instead of repeating blindly. No runtime privilege changes occur in preparation.

In Database Actions, set a different initial password privately for each new owner. Set Password Expired OFF, Account is Locked OFF and REST/Web access OFF. Preserve all existing accounts. Then, in the same verified ADMIN connection:

```sql
@"C:/Users/ROG STRIX G15/Desktop/sportify-platform/database/provisioning/verify-step10-test-owners.sql"
```

Both named authentication/grants/quota/empty-schema postconditions must pass. Copy no passwords to chat or source. The protected operator file is C:/Users/ROG STRIX G15/.sportify-secrets/oracle-step10-tests.env, based on [the template](../../database/provisioning/step10-test-migrations.env.example). Its ORACLE_MIGRATION_PASSWORD is the CLEAN owner's password; ORACLE_STEP10_UPGRADE_PASSWORD is the UPGRADE owner's password. Existing designated wallet/target/runtime verification credentials are reused privately; these owners never enter API/worker config.

Share the two sanitized PASS lines and confirm both password fields are filled. Run the suite from the repository in a dedicated PowerShell session. Existing process environment variables take precedence over the protected file, so use a session without conflicting Oracle overrides.

```powershell
Set-Location -LiteralPath 'C:/Users/ROG STRIX G15/Desktop/sportify-platform'
npx --yes pnpm@10.34.9 --filter '@sportify/api...' --filter '@sportify/worker...' --filter '@sportify/migrations...' -r build
node --env-file='C:/Users/ROG STRIX G15/.sportify-secrets/oracle-step10-tests.env' database/tests/oracle-step10.mjs
```

The full command verifies both clean owners before mutations. It applies versions 000001–000026 to CLEAN, rehearses 000001–000017 plus 000018–000026 with data to preserve in UPGRADE, and retains controlled failure and recovery history in CLEAN. Keep both schemas for review after the run. If a run stops after DDL, retain its state and inspect the named failing phase before planning recovery. The normal application owner has a separate read-only check.

The 27 November run stopped at a tenant-root identity harness assertion after completing installation. After correcting the assertion, `--continue-after-clean-install` succeeded. This mode requires the exact installed CLEAN catalog and history with only reference seeds and an empty UPGRADE schema. It repeats the runtime, history and seed checks and continues into the remaining fixtures. The finished UPGRADE history and CLEAN failure-and-repair history mean that both owners will now fail empty-schema prerequisites.

Use the same `node` command with `--lifecycle` for the runtime and compiled application checks without either owner password. On Windows, use `--console-api` and `--console-worker` separately in an interactive terminal, pressing Ctrl+C once after each ready line. The tool prints the native signal and pool-close result even if the PowerShell wrapper reports interruption.

## Retention and cleanup

Retain both owners until the Step 10 review and any agreed evidence retention are complete. CLEAN preserves the intentional failed and repaired ledger entries and `S7_RUNNER_FAILURE`. UPGRADE preserves its 26 applied entries. Both passed checks for empty business tables, no residual fixture grants and the expected set of objects. Preserve the sanitized summaries, raw-log hashes and tested-source checkpoint before any owner decommissioning.

The database operator controls the disposable credentials and any later decommissioning. Keep credentials protected and grants unchanged while the evidence is retained. Review scope, evidence retention and any credential revocation or account cleanup in a separate operator change. The current review sets no new numeric retention window. Fresh verification uses separately designated empty identities. [Final postconditions](verification-report.md) · [Checkpoint](step10-review-checkpoint.md)
