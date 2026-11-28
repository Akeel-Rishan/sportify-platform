# Step 12 development integration

**PASS — development integration complete.** On 28 November 2026, the D-34 maintenance run applied `000028` and all nine reviewed grants to `SPORTIFY_SCHEMA_OWNER` on development ATP `fce953xa`. Both public account flags remained disabled. [Isolated verification](step12-verification.md#live-oracle-evidence) · [Owner approval](../planning/decision-register.md#d-34--step-12-final-approval-and-development-integration-authorization) · [Application results](#application-verification-results)

## Migration 000028 catalog

| Object                        | Reviewed change                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AUTH_SESSIONS`               | Adds nullable `IDLE_EXPIRES_AT_UTC TIMESTAMP(6)` and `REVOKE_REASON VARCHAR2(20 CHAR)`. Adds checks for idle deadline order and the permitted reason values on revoked sessions. Existing rows remain valid. Legacy dashboard rows without an idle deadline do not authenticate through Step 12. |
| `AUTH_SOURCE_WINDOWS`         | Widens `CK_AUTH_SOURCE_SCOPE` to include `LOGIN`, `LOGIN_PAIR`, `SESSION`, `RESET_REQ` and `RESET_OK` while preserving `ISSUE` and `CONFIRM`. Adds and validates the wider check before dropping the old check and renaming the new one.                                                         |
| `VW_AUTH_DASHBOARD_SESSIONS`  | Projects the necessary dashboard session fields and limits inserts with an audience and unrevoked-state check option.                                                                                                                                                                            |
| `VW_AUTH_SESSION_REVOCATION`  | Projects IDs and revocation fields for unrevoked sessions. Password reset uses it across audiences.                                                                                                                                                                                              |
| `VW_AUTH_PASSWORD_RESET_MAIL` | A read-only projection of eligible account and token data for reset delivery.                                                                                                                                                                                                                    |

The migration adds no tables, indexes, seeds or data backfills. The isolated and application catalogs both verified **28 applied migrations, 50 tables, 575 table columns, 470 named constraints, 103 explicit indexes and four valid views**. [Migration SQL](../../database/migrations/000028_account_sessions)

## Controlled application sequence

1. Confirm the D-34 scope, local flags and verified 27-entry ledger. Review baseline aggregate data counts, current grants, and `CREATE VIEW` and advisory lock capabilities. Archive the exact history, reference IDs and verified recovery inputs outside the checkout.
2. Pause the application writers and verify zero conflicting Oracle sessions, jobs and migrations using the read-only ADMIN gate during maintenance. Compare the installed catalog and ledger checksums to the exact `000001`–`000027` manifest prefix. The full plan must show only `000028` pending. [Maintenance script](../../database/provisioning/verify-step12-development-maintenance.sql)
3. Under the existing migration advisory lock, apply only `000028`, verify the catalog and replay with the retained application-owner configuration. Require `applied: []` on replay. Compare all original ledger entries and records to the protected snapshot.
4. Apply only the nine supplemental statements in the [Step 12 grant matrix](../../database/provisioning/step12-runtime-grants.mjs) using the verified application owner. The matrix produces four table/view entries and 17 specific column entries. Preserve Step 11's 21 reviewed statements and original Oracle user-account grants. Expect the combined application-object matrix to have 13 table/view and 76 column privileges. No grant or admin options are needed.
5. Verify the catalog, the dashboard view's check option, the revocation view's filtered rows and the reset-mail view's read-only flag. Confirm both runtime accounts have only `CREATE SESSION` as a system privilege, their exact application grants and no roles. Test documented reads and denials without adding fixtures to the application schema. Record a fresh no-secret verification report before releasing maintenance.

The reviewed grant SQL can be generated offline from the repository root for a later approval review.

```powershell
@'
import { accountGrants } from './database/provisioning/step12-runtime-grants.mjs';
for (const [grantee, object, privilege, columns] of accountGrants) {
  const columnList = columns ? ` (${columns})` : '';
  console.log(`GRANT ${privilege}${columnList} ON SPORTIFY_SCHEMA_OWNER.${object} TO ${grantee};`);
}
'@ | node --input-type=module
```

## Forward recovery

Oracle can commit each DDL statement independently. If a statement fails, stop grant application, keep the routes disabled and capture the actual partial catalog, statement step and retained `FAILED` or `RUNNING` ledger. Check which definition of the source-scope constraint is active before touching it. Preserve the existing session constraints and all original history. Use a separately approved forward repair tied to the failed migration under the same advisory lock, with exact partial and final postconditions. If grants partly apply, audit the delta and reconcile only the authorized missing or newly added entries. Schema rebuild or destructive recovery needs separate approval. [Migration recovery](../database/migration-guide.md#verification-and-forward-fix-recovery)

### Seed-only recovery baseline

The preflight counted every application table and found business, customer and transaction tables empty. The populated tables were the 27-entry ledger and the eight sports and 20 permissions. Exact seed values matched the pinned SQL. The private archive records original ledger rows, reference IDs and values, aggregate table counts, baseline grants and finite quota. The Step 12 isolated clean installation verified the full catalog after the same first 27 migrations. [Isolated release evidence](step12-verification.md#live-oracle-evidence)

A separately approved seed-only rebuild would use Git checkpoint `2e61eda96ab4b536c12861ff57ba78615353c96a` and its 27 original manifest entries and 248 SQL and seed files. Restore the original account and advisory-lock capabilities, the recorded owner quota and direct `CREATE VIEW`, then install and verify the pinned baseline. Replay must apply nothing. Reproduce the 21 exact Step 11 grants, verify both runtime identities, and compare seed values by their stable codes. The new ledger timestamps and generated seed identities belong to the rebuilt schema. Preserve the original ledger and seed identities in the archive as recovery evidence. Recheck the data inventory before any future recovery decision. [Baseline accounts](../../database/provisioning/provision-accounts.sql) · [Step 11 grants and recovery](step11-development-integration.md)

## Integration checkpoint

28 November 2026. The local process inventory found no SPORTIFY writers, services or enabled scheduled tasks, and the local Docker engine was stopped. The restricted owner confirmed zero enabled owner jobs. The operator's ADMIN transcript confirmed `fce953xa`, zero SPORTIFY sessions and jobs, and 27 applied migrations. The local writer recheck passed immediately before the application owner connected. [Maintenance gate](../../database/provisioning/verify-step12-development-maintenance.sql)

The read-only Oracle preflight on `fce953xa` verified the exact `SPORTIFY_SCHEMA_OWNER` identity, 27 applied migrations and `000028` as the only pending migration. The catalog had 50 tables, 573 table columns, 468 named constraints, 103 explicit indexes and one read-only view. All 27 original manifest entries and 248 artifacts matched Git. The reviewed `000028` contains nine SQL statements and has checksum `18f55d45635f59c4893b5a3666009216bebfcb0a1df0c9e1d95bc029cf38152f`.

The API had eight table privileges and 59 column privileges. The worker had one read privilege on the verification mail view. Both had only `CREATE SESSION` and zero roles or application PUBLIC grants. The owner has direct `CREATE VIEW` and `SYS.DBMS_LOCK` execution. Both public flags were disabled. The nine approved grant statements expand to four object grants and 17 column grants. The canonical reviewed grant matrix digest is `5b9551ec881b3654ece52dd4f83fe30379283137f770aa7ae66c6eacc08a8b39`.

The private archive is `.sportify-secrets/step12-dev-recovery-baseline-20261128102703087.json` with verified SHA-256 `f20389604573b0b76c1723234c31f0d8cc16414750b70b3b10ac71af38a65d2b`. The verified snapshot contains no credentials. The application owner revalidated the current catalog, grants, counts, ledger and seeds against the archive before applying DDL.

## Application verification results

| Check                     | Observed result                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration and replay      | Applied only `000028_account_sessions` under the advisory lock. Replay applied nothing. All 28 ledger rows are `APPLIED` with no pending versions or repairs.                                                                                                                                                                                                                                |
| Catalog and integrity     | Verified 50 tables, 575 table columns, 470 named constraints, 103 explicit indexes and four valid views. The exact catalog included the session idle and revocation checks, source-scope check and existing password-reset constraints. Oracle reported the dashboard check option as enabled and the reset-mail view as read-only. The three new view definitions matched the reviewed SQL. |
| Supplemental grants       | Applied all nine approved statements. The API received SELECT and column-restricted INSERT/UPDATE on the dashboard session view and reset-token table, plus SELECT and column-restricted UPDATE on the revocation view. The worker received READ on the reset-mail view.                                                                                                                     |
| Runtime verification      | API passed 10 allowed reads and six denial probes. Worker passed two allowed reads and nine denials. Both retained only `CREATE SESSION`, zero roles and no grant option. The combined exact application matrix has 13 object grants and 76 column grants, with no application PUBLIC grants.                                                                                                |
| History and data          | All 27 prior ledger rows matched the archive. Other table counts were unchanged. The eight sports and 20 permissions retained their IDs and values, and business tables remained empty.                                                                                                                                                                                                      |
| Source and runtime safety | The changed-source audit found zero configured-secret matches or private-file candidates. All original 27 manifest entries and 248 SQL and seed files remained unchanged. Both public account flags stayed disabled.                                                                                                                                                                         |

The runtime checks used read-only probes on the application schema. Workflow writes, race tests and injected rollback evidence remain scoped to the isolated suite. [Isolated workflow evidence](step12-verification.md#live-oracle-evidence)

### Completed private ADMIN maintenance check

From PowerShell, start SQLcl in the approved wallet directory.

```powershell
Set-Location -LiteralPath "$env:USERPROFILE/.sportify-secrets/sqlcl-current"
& 'C:/sqlcl/bin/sql.exe' /nolog
```

Run each command on its own line at `SQL>`. Enter the ADMIN password at its private prompt.

```sql
SET CLOUDCONFIG Wallet_SPORTIFYDEV.zip
CONNECT ADMIN@sportifydev_low
```

After SQLcl shows `Connected.`, run the read-only check.

```sql
VARIABLE operator_confirmation VARCHAR2(32)
EXEC :operator_confirmation := 'STEP12_DEV_MAINTENANCE';
@"C:/Users/ROG STRIX G15/Desktop/sportify-platform/database/provisioning/verify-step12-development-maintenance.sql"
```

The operator supplied the `PASS` line before the application-owner session began.

## Release prerequisites

| Owner and phase                         | Acceptance criteria while the routes remain disabled                                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Worker and backend, delivery workstream | Atomic outbox-to-job dispatch, fenced claims, bounded retries and durable redacted attempt records. Separate local fixtures, provider acceptance and actual test inbox receipt.                                                      |
| Security and operator, staging setup    | Independent versioned keys in the approved store, rotation rehearsal and a validated local compromised-password corpus. Configure the explicit login pair, session source and reset outbox limits against the shared network budget. |
| Platform operator, ingress verification | Same-origin HTTPS `https://app.sportify.lk/api/v1`. Confirm trusted proxy boundaries, scrub untrusted forwarded values, verify source limits behind the real ingress, then run deployed sibling-host and session smoke checks.       |
| Platform and QA, staging release        | Run the selected ARM64 artifacts, lifecycle and deployment smoke, recovery and rollback. Obtain separate release approval before enabling routes.                                                                                    |

The development integration verifies schema and least privilege. Public rollout requires the separate staging evidence above.

The roadmap assigns Step 13 to pilot verification and release review after the release prerequisites. It calls for two full tenant journeys, role-based UAT, three-language accessibility and responsive checks, realistic load verification, recovery evidence and agreed rollback and support ownership. [Approved roadmap](../planning/development-roadmap.md#step-13--pilot-verification-and-release-review)

[Oracle view DDL](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/CREATE-VIEW.html) · [Oracle object privileges](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/GRANT.html) · [Oracle commit behavior](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/COMMIT.html)
