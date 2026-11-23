# Step 09 verification and operator gates

## Current result - executed and verified on Oracle

23 November 2026. **Step 09 engineering and Oracle verification gates passed; awaiting user verification. Stop before Step 10.** All D-24 approvals and exclusions are preserved. Operator ADMIN evidence confirmed fce953xa / COMPATIBLE 23.5.0, followed by the exact test-owner authentication/grants/quota/empty-schema PASS. Private prerequisites validated without printing values. The manifest is ready/empty blockedBy; actual results below, rather than readiness of the manifest alone, establish this completed database gate.

| Check                           | Actual result                                                                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application history             | Original 000001-000026 all APPLIED; no repairs, failures or pending versions                                                                       |
| Application delta               | Exactly 000018-000026 applied; repeat returned applied:[]                                                                                          |
| Standard compiled verify/status | Both exited 0; full catalog verified and pending:[]                                                                                                |
| Catalog                         | 49 tables, 569 columns, 463 named enabled/validated constraints, 101 explicit indexes; zero invalid objects                                        |
| Prior data/history              | Original 17 checksums/history rows and all pre-release table row counts unchanged                                                                  |
| Reference/commercial records    | Eight sports and 20 permissions retained; all new commercial/theme catalogs remain empty; no new seed                                              |
| Isolated real suite             | Complete invocation exited 0: 53 specific integrity rejections, positive scopes/history, transaction/concurrency, cleanup and both runtime checks  |
| Isolated retained history       | 27 records: FAILED 000019 retained and linked to APPLIED test-only 000027; other original phases APPLIED; no pending                               |
| Fixture cleanup                 | All 46 non-reference/non-history tables empty in the isolated schema; no synthetic records installed in the application schema                     |
| Actual application privileges   | API and worker positive identity/UTC DUAL probes plus 17 exact Oracle denials each for new-table/history reads and audit mutation; no grants added |
| Local quality                   | pnpm check passed formatting, zero-warning lint, types, 24 files / 210 unit and HTTP tests, and all production builds                              |
| Coverage                        | Configured gates passed: 90.3% statements, 83.42% branches, 89.3% functions, 92.35% lines; production-source coverage, not Oracle coverage         |

No subscription management/enforcement, website rendering/routing/upload, audit emitter, job processor, notification delivery, secret replay or end-to-end request-idempotency API is made operational by these tables. No commercial prices/codes/quotas, trial/grace durations, retention/collection policy or numeric lease/retry/timing defaults are invented or seeded. No runtime object grant, infrastructure/network change, deployment, commit or push. ARM64, capacity/query-plan benchmarking and real external delivery/production crash recovery are not claimed.

## Initial failures and retained recovery

The first isolated invocation was not clean: 000019's SQL completed, but Oracle stored its searched CASE IN index as equivalent simple CASE arms. The runner retained FAILED 000019 and its original checksum. The comparator now folds only literal simple CASE arms returning one identical identifier, with no ELSE or expression changes; tests reject changed selector/literal/return behavior. Full original 19-phase actual catalog verification passed after that correction. No migration SQL or constraint was rewritten or relaxed. The comparison follows [Oracle 19c CASE semantics](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CASE-Expressions.html), consulted during this correction; the exact catalog rewrite was observed on the designated server.

The exact --reconcile-case-catalog procedure is restricted to SPORTIFY_STEP09_TEST_OWNER, matching checksums, the observed failed/linked history, full expected catalog and zero fixture/business rows. It recorded deterministic test-only 000027 and atomically linked FAILED 000019, then applied original 000020-000026. It accepts only the known failed prefix, its linked prefix or the completely installed linked release; no general partial-state adoption/reset exists. Its virtual repair is absent from application artifacts/history. Prior Step 07 and Step 08 owners/recoveries are untouched.

A later full invocation passed integrity and transaction checks but failed during worker privilege verification. A worker-only bounded verification passed with unchanged credentials/grants; its initial cause remains unconfirmed. Safe role/stage/error-number logging was added without raw messages/stacks. The subsequent COMPLETE invocation exited 0, including both runtimes and cleanup. The worker-only diagnostic was not substituted for a complete passing suite. No password/grant/timeout was changed to hide the failure.

Only after the complete isolated pass did the application release run. Application 000018-000026 applied cleanly, repeated with no changes and passed standard verify/status plus an independent catalog/history/data-count audit. Additional actual application runtime denials passed after installation.

## Executed commands and repeat verification

With secrets loaded only into the designated operator child process, not build tooling:

```powershell
npx --yes pnpm@10.34.9 build:packages
# First isolated invocation retained the documented 000019 failure:
node --env-file="C:/Users/ROG STRIX G15/.sportify-secrets/oracle-step09-tests.env" database/tests/oracle-step09.mjs
# After the tested comparator correction and exact-state recovery review:
node --env-file="C:/Users/ROG STRIX G15/.sportify-secrets/oracle-step09-tests.env" database/tests/oracle-step09.mjs --reconcile-case-catalog
# The final complete invocation above exited 0 before application release:
node --env-file="database/provisioning/migrations.env" infra/scripts/database-migrate.mjs
node --env-file="database/provisioning/migrations.env" infra/scripts/database-migrate.mjs
node --env-file="database/provisioning/migrations.env" infra/scripts/database-verify.mjs
node --env-file="database/provisioning/migrations.env" infra/scripts/database-status.mjs
npx --yes pnpm@10.34.9 check
npx --yes pnpm@10.34.9 test:coverage
```

No further Step 09 account preparation or application migration action is required. Do not rerun account creation or initial empty-schema checks against installed test schemas. The normal empty-owner suite intentionally refuses the now-used test owner; only its exact guarded linked state supports the recovery flag. Preserve all old test histories.

For user verification, from the repository, use the existing protected owner configuration:

```powershell
node --env-file="database/provisioning/migrations.env" infra/scripts/database-status.mjs
node --env-file="database/provisioning/migrations.env" infra/scripts/database-verify.mjs
```

Expect 26 APPLIED/no repair/pending versions and migration.verified. The verify command acquires its existing bounded advisory lock; it makes no business-data/schema changes. Keep credentials private. Review the retained failure/recovery record, empty unapproved catalogs, no-runtime-grant boundary and D-24 exclusions. This is the user verification checklist, not a request to reapprove policies.

## Enforcement and limitations

| Area                 | Oracle evidence                                                                                                                                           | Future application responsibility                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Subscription history | Term/feature snapshots remain unchanged when catalog fixture terms change; current-term uniqueness and tenant/currency FKs tested                         | Authorized immutable history, interval-overlap locking, commercial configuration and effective eligibility                             |
| Invoice settlement   | Positive money/currency, matched admin actors, retained void metadata and restrictive references tested                                                   | Locked aggregate caps, multiple-receipt allocation/reversal, decimal input scale validation and reconciliation                         |
| Website ownership    | Global canonical slug reservation across retained states and tenant/business/media ownership negatives passed                                             | Trusted-host parsing, reserved deployment names, publication validation, safe content and storage validation                           |
| Audit                | Actor/scope FKs and strict unique-key JSON checks passed; runtime mutation denied                                                                         | Minimal allowlisted payload schemas, authentication/authorization and approved collection/retention                                    |
| Outbox/jobs          | Atomic source/event commit/rollback, consumer fan-out/dedupe, skip-locked claim, expired reclaim and stale-token rejection passed in test-only harnesses  | Production dispatcher/worker, explicit operating budgets, backoff and idempotent external side effects; no exactly-once promise        |
| Idempotency          | Tenant and partially-null platform uniqueness, independent scopes, contenders, atomic fixture completion/rollback and harness fingerprint conflict passed | Endpoint authorization/canonicalization, explicit TTL/lease/retention, safe replay schema and reconciliation; no secret-bearing replay |

Original 17 entry definitions/168 prior SQL-seed hashes and all 26 release entries/239 authored SQL-seed hashes are preserved. Build outputs/logs/wallets/private environment files remain ignored. Final source hygiene passed across 122 changed/new files: zero configured credential matches or generated/secret-file candidates, unchanged application code/lockfile/HEAD, preserved 17/168 and 26/239 entry/hash snapshots, no focused/disabled tests, and git diff --check success. Only verified Next-generated declaration imports were restored; no UI code changed. No disabled constraint, fake successful test, production test endpoint, generic CRUD layer or business processor was added.

## Historical approval and operator checkpoints

The sections below retain the earlier pending states and original commands as history. The completed result above supersedes their execution status; they are not instructions to recreate accounts or repeat initial empty-schema preparation.

Historical D-24 checkpoint, 23 November 2026. **At that point the policies were approved and SQL remained unapplied; later execution above supersedes that status.** This reconciliation records approval, not an Oracle execution result. Step 10 remains pending.

## Approved decisions and explicit exclusions

- **Subscriptions:** lifecycle, historical plan/feature snapshots and multiple manual invoice-payment receipts up to outstanding are approved. [Exact storage/transaction boundary](subscription-history.md). Step 08 venue full-only payment/refund policy remains unchanged.
- **Website and audit:** canonical slug reservation across retained states, prohibition of unapproved reuse and privacy-minimal scoped audit are approved. [Website ownership](website-ownership.md), [audit boundary](step09-operations.md).
- **Operations:** outbox-to-consumer-job handoff/fan-out, fenced bounded leases and scoped idempotency owner/fingerprint/replay/expired-key behavior are approved. [Exact operational rules](step09-operations.md).

The following remain **undecided**, not approved defaults or seeds: commercial subscription prices; plan/feature codes; commercial feature quotas/entitlements; trial/grace durations; audit/data-retention periods; numeric lease/retry/operational timing; IP/user-agent collection; secret replay behavior and retention. Approval of a structural mechanism does not fill those configuration values. No secret-bearing replay is implemented. These exclusions do not reopen or alter prior Step 07/08 decisions.

Unapplied SQL requires explicit plan price/currency/interval/trial and entitlement enablement inputs. OUTBOX_EVENTS and JOB_QUEUE require explicit MAX_ATTEMPTS and scheduling timestamps: former five-attempt and immediate-scheduling defaults are removed. Static positive bounds and initial zero counters are not a selected retry policy. Creation timestamps and payload versions remain storage metadata. Synthetic fixture codes/amounts/quotas/budgets/times and verification wait limits are test data/controls only; they are never application configuration or reference seeds.

## Inventory and preservation

| Version | Tables                                        | State                            |
| ------- | --------------------------------------------- | -------------------------------- |
| 000018  | SUBSCRIPTION_PLANS, SUBSCRIPTION_ENTITLEMENTS | Approved structure; not executed |
| 000019  | SUBSCRIPTIONS, SUBSCRIPTION_FEATURE_SNAPSHOTS | Approved structure; not executed |
| 000020  | SUBSCRIPTION_INVOICES, SUBSCRIPTION_PAYMENTS  | Approved structure; not executed |
| 000021  | WEBSITE_THEMES, WEBSITE_SETTINGS              | Approved structure; not executed |
| 000022  | WEBSITE_MEDIA                                 | Approved structure; not executed |
| 000023  | AUDIT_LOGS                                    | Approved structure; not executed |
| 000024  | OUTBOX_EVENTS                                 | Approved structure; not executed |
| 000025  | JOB_QUEUE                                     | Approved structure; not executed |
| 000026  | IDEMPOTENCY_KEYS                              | Approved structure; not executed |

Nine phases/71 SQL files add 13 tables, 175 columns, 143 named constraints and 34 explicit indexes. Full release artifacts: 26 phases/49 tables/569 columns/463 constraints/101 explicit indexes. PK/UK backing indexes are not duplicated. No payload-content index or performance/capacity claim. Original 000001-000017 entry metadata and all 168 earlier SQL/seed bytes remain immutable. Only unapplied Step 09 defaults/metadata and test/documentation sources are reconciled; no existing database records/history are touched.

DOMAINS/custom-domain verification, notifications and unassigned PLATFORM_SETTINGS/ONBOARDING_PROGRESS remain excluded. WEBSITE_SETTINGS.SUBDOMAIN_SLUG is the sole host source. No new plan/feature/theme/permission seed or runtime grant. Existing eight sports/20 permissions remain unchanged; API/worker currently have no new duty beyond DUAL probes. No subscription enforcement, website rendering, audit emission, job processor or end-to-end request-idempotency service is implemented.

## Execution gates and manifest state

D-24 clears STEP09_SUBSCRIPTIONS, STEP09_WEBSITE_AUDIT and STEP09_OPERATIONS. Those policies are approved and must not be requested again. The manifest is **ready** with empty blockedBy: the operator has supplied both compatibility and initial test-owner postcondition evidence. This admits isolated verification only; application migrations still require the complete isolated pass.

| Hold                           | Required evidence                                                                                                                   | Current result                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| STEP09_ORACLE_COMPATIBILITY    | ADMIN confirms exact target/identity and actual COMPATIBLE supporting the authored 19c-compatible SQL                               | PASS: operator ADMIN query on fce953xa returned 23.5.0; hold cleared                                                        |
| STEP09_TEST_OWNER_PROVISIONING | Exact fresh SPORTIFY_STEP09_TEST_OWNER, private initial authentication, narrow grants, finite quota and empty-schema postconditions | PASS: operator verify-step09-test-owner.sql confirmed initial identity/authentication, exact grants, quota and empty schema |

The existing DESIGN_REVIEW_REQUIRED guard name is retained for CLI compatibility. Here it means a release hold remains, not that approved policies are unanswered. The test-owner hold is now cleared on actual operator evidence. This clears prerequisites, not the isolated/application migration result. Clear a hold only after recording its actual evidence; do not manually bypass it to make a command succeed.

After the remaining test-owner hold clears, a ready manifest permits the **isolated** suite to establish migration/integrity/concurrency evidence. A complete passing isolated suite is a separate additional gate for **application-owner** migration. It cannot be required as a prerequisite to the very isolated run that establishes it. No account preparation or Oracle migration/test is executed during this approval reconciliation. Approval, a ready plan or a successful login alone never marks Step 09 verified.

## Existing evidence and unexecuted checks

Before the original Step 09 edits, pnpm check passed 201 unit/HTTP tests and all quality/build checks. Actual read-only baseline verify/status passed on designated development ATP fce953xa: original 17 APPLIED, no repairs/pending entries and exact Step 08 catalog. That installation remains the verified 36-table baseline, not an executed 49-table Step 09 schema.

The earlier bounded read-only probe reported server 23.26.4.1.0. V$PARAMETER access was denied to the restricted owner (ORA-00942), so that earlier attempt did not establish COMPATIBLE. The subsequent user-supplied ADMIN SQLcl transcript (23 November 2026, session started 20:49:46) confirms TARGET=fce953xa, IDENTITY=ADMIN and COMPATIBLE=23.5.0. STEP09_ORACLE_COMPATIBILITY is cleared on that actual operator evidence; the agent did not reconnect or infer it from the server release. A bound CLOB IS JSON STRICT WITH UNIQUE KEYS predicate accepted valid JSON and rejected duplicate/malformed inputs on DUAL, without DDL. The authored syntax uses documented 19c-compatible CLOB checks/ordinary indexes; no native JSON type. This functional probe does not prove new constraint DDL/catalog behavior or the actual compatibility parameter.

Earlier metadata showed SPORTIFY_STEP09_TEST_OWNER absent. The subsequent user-supplied ADMIN transcript confirms provision-step09-test-owner.sql passed on fce953xa and created the account locked without password authentication. The subsequent user-supplied verify-step09-test-owner.sql PASS now establishes initial authentication, exact grants, quota and empty-schema postconditions. This is operator evidence, not an agent-executed provisioning call. The agent did not execute the script. A separate restricted private configuration was prepared with a blank new-owner password; existing Step 07/08 configurations/history remain preserved. No fresh account-state query is claimed during reconciliation. No Step 09 owner login, schema migration, fixture, concurrency or runtime privilege suite has run. The operator has now performed only the reviewed account-preparation DDL/grants; initial password/unlock and exact postconditions have now passed according to the user-supplied SQLcl verification.

Pre-approval local checks passed: pnpm check (23 files / 205 unit and HTTP tests, formatting/lint/types/builds), coverage gates (90.11% statements, 83.8% branches, 89.3% functions, 92.19% lines), scoped artifact/dictionary/FK/index/ERD/link checks, JavaScript syntax and restricted-expression parser checks. Mermaid/headless Chrome rendered the ERD. A 117-file audit found no configured credential matches, preserved original hashes and restored only known generated Next declaration differences. These are historical local results, not reconciliation results or Oracle evidence.

Reconciliation verification passed: focused baseline 14 tests; final pnpm check exited 0 with formatting, zero-warning lint, strict types, 23 files / 205 unit and HTTP tests and all production builds. Scoped Step 07/08/09 and broader dictionary/FK/index/ERD/link checks passed. The final compiled local plan reports review, exactly the two technical holds, 26 artifacts and oracleValidated:false. Sanitized migrate/verify/isolated-suite CLI rejection checks exited 1 with DESIGN_REVIEW_REQUIRED before credentials/connection; unconfigured status failed safe prerequisites. These rejection checks performed no Oracle work.

The 118-file source audit found zero configured credential matches or generated/secret-file candidates and confirmed all original 17 entries/168 SQL-seed hashes unchanged. Compared with the dirty pre-reconciliation snapshot, only three unapplied SQL files changed: subscription entitlement enablement, outbox retry/scheduling defaults and job retry/scheduling defaults. Previous work was preserved, generated Next declarations restored only after verifying their known build changes, git diff --check passed and HEAD stayed unchanged. No Oracle connectivity/provisioning/migration/integrity/concurrency command reached a database; live results remain BLOCKED. Coverage was not rerun for this reconciliation: the production implementation was unchanged and the earlier coverage result remains historical. Unit checks and mocked setup validate fixture behavior only, not Oracle syntax, NULL uniqueness, tenant FKs, lease fencing or concurrency. Real missing-retry-budget assertions expect ORA-01400; over-budget cases use an explicit synthetic cap. They are test sources until actually run on Oracle.

## Exact operator instructions

### 1. Read-only ADMIN target and compatibility check - completed

In a dedicated PowerShell terminal using the current protected wallet directory:

```powershell
Set-Location -LiteralPath "C:/Users/ROG STRIX G15/.sportify-secrets/sqlcl-current"
& "C:/sqlcl/bin/sql.exe" /nolog
```

At SQLcl, enter ADMIN's password only at its private prompt:

```sql
SET ECHO OFF
SET VERIFY OFF
SPOOL OFF
SET CLOUDCONFIG Wallet_SPORTIFYDEV.zip
CONNECT ADMIN@sportifydev_low
SELECT SYS_CONTEXT('USERENV','DB_UNIQUE_NAME') AS TARGET,
       SYS_CONTEXT('USERENV','SESSION_USER') AS IDENTITY FROM DUAL;
SELECT NAME, VALUE FROM V$PARAMETER WHERE NAME='compatible';
```

Expected target/identity: fce953xa / ADMIN. Record the actual COMPATIBLE value and confirm it supports the authored SQL (19c or later). Stop if target/identity differs or compatibility cannot be established; do not add broad privileges or infer compatibility from server version alone. Share only those query results, never a password, wallet or descriptor. The supplied operator results match fce953xa / ADMIN / 23.5.0 and this gate has passed. No repeat is required in the same verified session. The next operator action is section 2, not migration execution.

<a id="2-test-owner-prepared---initial-authentication-and-postconditions-next"></a>

### 2. Test-owner preparation and initial postconditions - completed

The operator has completed the creation block below successfully. Do not rerun it. Initial password/unlock and the postcondition block have now passed; retain the commands below as evidence, not instructions to recreate or reset the account. Never reuse/drop/reset the used Step 07/08 test owners or their retained repairs. If SPORTIFY_STEP09_TEST_OWNER already exists, stop and inspect its state; do not rerun creation or reset it. In the verified ADMIN connection:

```sql
VARIABLE expected_db_unique_name VARCHAR2(128)
VARIABLE operator_confirmation VARCHAR2(32)
VARIABLE owner_quota_mb NUMBER
EXEC :expected_db_unique_name := 'fce953xa';
EXEC :operator_confirmation := 'DISPOSABLE_STEP09_OWNER';
EXEC :owner_quota_mb := 256;
@"C:/Users/ROG STRIX G15/Desktop/sportify-platform/database/provisioning/provision-step09-test-owner.sql"
```

This reviewed test-owner quota is an existing finite test allocation, not a commercial feature quota. Creation is non-atomic DDL; partial failure requires inspection and reviewed recovery, not blind repetition. In Database Actions, set this new owner's unique initial password privately; Password Expired OFF, Account is Locked OFF, REST/Web access OFF. Never copy an old owner's password or reset an existing account. Back in ADMIN SQLcl (reconnect/redeclare binds if it exited):

```sql
EXEC :expected_db_unique_name := 'fce953xa';
EXEC :owner_quota_mb := 256;
@"C:/Users/ROG STRIX G15/Desktop/sportify-platform/database/provisioning/verify-step09-test-owner.sql"
```

Required postconditions: password authentication/open account, only CREATE SESSION/TABLE/SEQUENCE, no roles/admin options, only SYS.DBMS_LOCK EXECUTE without grant option, exactly 256 MB DATA quota and no objects. Keep all prior users/grants/history intact. Supply only sanitized PASS output.

Enter the new password privately in C:/Users/ROG STRIX G15/.sportify-secrets/oracle-step09-tests.env. Use [this template](../../database/provisioning/step09-test-migrations.env.example) if needed. Schema/user must both be SPORTIFY_STEP09_TEST_OWNER; designated-development and isolated-disposable-empty confirmations plus expected fce953xa are required. Preserve current mTLS and distinct runtime verification credentials. Use a dedicated terminal without conflicting ORACLE_* variables: process environment takes precedence. Owner secrets never go into API/worker files, chat, arguments or tracked examples.

### 3. Record evidence and run the isolated suite only

Compatibility and account postconditions are now recorded; STEP09_TEST_OWNER_PROVISIONING is cleared. Private local prerequisites validated successfully without printing credentials. No further policy approval is needed. The isolated suite has its own exact owner/target/grant/quota/empty-schema checks. After manifest readiness is recorded, from the repo:

```powershell
Set-Location -LiteralPath "C:/Users/ROG STRIX G15/Desktop/sportify-platform"
npx --yes pnpm@10.34.9 build:packages
node infra/scripts/database-plan.mjs
node --env-file="C:/Users/ROG STRIX G15/.sportify-secrets/oracle-step09-tests.env" database/tests/oracle-step09.mjs
```

Plan must be ready with empty blockedBy, 26 artifacts and oracleValidated:false. It is still only a plan. The COMPLETE isolated suite must exit 0, including apply/repeat/catalog/seeds/checksum refusal, integrity, transaction/concurrency, runtime denials and cleanup. Fixtures supply synthetic commercial/operating values only in this disposable schema; none become production seeds/configuration. This staged test run is how the isolated gate is established, not an application deployment.

### 4. Application release only after the complete isolated pass

Record the actual isolated result first. Using the existing protected application-owner configuration (never the test-owner file):

```powershell
node --env-file="database/provisioning/migrations.env" infra/scripts/database-status.mjs
node --env-file="database/provisioning/migrations.env" infra/scripts/database-migrate.mjs
node --env-file="database/provisioning/migrations.env" infra/scripts/database-migrate.mjs
node --env-file="database/provisioning/migrations.env" infra/scripts/database-verify.mjs
node --env-file="database/provisioning/migrations.env" infra/scripts/database-status.mjs
```

Expected application delta: exactly 000018-000026; repeat applied:[]; verify success; 26 APPLIED/no pending. Preserve prior 17 checksums and existing data counts. Failed DDL retains RUNNING/FAILED history/partial state; use the established specific reviewed forward-repair procedure. Never rewrite applied SQL, mark failure successful, disable constraints, clear ledgers or drop owners. The isolated suite has no general reset/resume flag; investigate failure before authoring a deliberate recovery.

## Initial isolated failure and reviewed recovery

The first isolated invocation did not pass cleanly. Original 000001-000018 reached APPLIED; 000019 executed its SQL then retained FAILED after catalog comparison. Oracle stored UX_SUBSCRIPTIONS_ONE_CURRENT as simple CASE with five literal arms returning TENANT_ID, equivalent to the authored searched CASE IN list. No DDL change is needed. The corrected comparator folds only this restricted equal-return/no-ELSE shape; changed literals/selectors/return branches remain mismatches. Focused unit tests passed, and actual read-only verification of the complete unchanged 19-phase catalog passed.

The explicit --reconcile-case-catalog path is restricted to SPORTIFY_STEP09_TEST_OWNER, exact checksums/history/catalog and no fixture/business rows. It records deterministic test-only 000027, retains FAILED 000019 and links its repair; the application manifest remains the original 26 entries. It accepts only this exact failed prefix, its linked prefix or the completely installed linked release. No general reset/partial-state adoption exists. Initial recovery and resumed checks remain in progress; a passing complete isolated suite is still required before any application mutation. The operator command is:

```powershell
node --env-file="C:/Users/ROG STRIX G15/.sportify-secrets/oracle-step09-tests.env" database/tests/oracle-step09.mjs --reconcile-case-catalog
```

## Harness safety and limits

The harness uses separate Oracle connections and bounded database-side markers. DBMS_LOCK allocation happens before DML because it commits. Job claims use direct-key FOR UPDATE SKIP LOCKED, never FETCH FIRST with FOR UPDATE. Known synthetic roots/platform IDs/run markers are checked before child-first cleanup; schema/history/reference data remain. Privilege tests prove positive identity/DUAL connectivity before requiring ORA-00942/01031; connection errors are not passing denials. No external messages, real business records, live billing, production job loop or secret replay is involved.

Numeric test wait limits and explicit synthetic fixtures do not approve runtime job leases/retry/backoff or commercial settings. Actual Oracle integrity/concurrency/grant verification and application apply/repeat/catalog remain BLOCKED. No Step 10, dependency/framework upgrade, ARM64 execution, deployment, commit or push.

## References

The original implementation consulted [Oracle 19c JSON conditions](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SQL-JSON-Conditions.html), [strict JSON/unique keys](https://docs.oracle.com/en/database/oracle/oracle-database/19/adjsn/conditions-is-json-and-is-not-json.html), [locking restrictions](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SELECT.html), [transactions](https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/transaction-processing-and-control.html), [unique constraints and NULL components](https://docs.oracle.com/en/database/oracle/oracle-database/26/cncpt/data-integrity.html) and [node-oracledb 26 connection handling](https://node-oracledb.readthedocs.io/en/v26.0.0/user_guide/connection_handling.html). No new version-dependent SQL mechanism is introduced by D-24 reconciliation. Thin mTLS, certificate/DN verification, UTC and exact decimal-string policies remain unchanged.
