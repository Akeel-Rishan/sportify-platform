# Explicit Step 07 Oracle testing

## Step 10 foundation suite

Run the complete suite once with the two exact disposable owners and protected configuration. Use the established migration runner and keep the deliberate failure history for review. The application schema has read-only checks. [Prerequisites and commands](../../Docs/database/step10-operator-setup.md) ? [Verification matrix](../../Docs/database/verification-report.md)

`pnpm test:oracle:step07` (compatibility alias: `pnpm test:oracle:runner`) is excluded from ordinary unit tests/PR CI. It requires an approved ready manifest, explicit migration-target confirmation, exact SPORTIFY_TEST_OWNER, a genuinely empty dedicated schema, its protected password/wallet settings and ORACLE_MIGRATION_TEST_CONFIRM=isolated-disposable-empty. Both real API/worker passwords must also be supplied as ORACLE_API_PASSWORD/ORACLE_WORKER_PASSWORD; validation occurs before owner mutation. Missing prerequisites fail, not skip/pass. D-18 now approves the ready manifest; target/lock/disposable identity and secret prerequisites remain mandatory.

The suite is implemented to check:

- Clean ordered apply and repeat no-op; exact metadata and seed postconditions; changed applied checksum refusal.
- Actual seed SQL executed twice while synthetic customization is preserved, then rolled back.
- Two-tenant integrity DML using exact decimal-string synthetic IDs above JS safe integer range, random UUIDs and example.invalid identities. Specific ORA-00001/02290/02291/02292 outcomes and registered constraint names are required. Cases cover membership/role duplication, cross-tenant roles/staff/resources/invitations, session/member/user context, same-tenant wrong-location resource references, flags, schedule nulls/weekday/uniqueness, buffers/rates and protected parent deletion. All integrity DML rolls back before DDL fixtures.
- Two actual owner sessions proving the advisory lock survives a suite-created table's DDL commit; only that nonce-named table is dropped afterward.
- A controlled ORA-00904 after a fixture CREATE has committed, durable FAILED state, no later migration and refused normal retry. A separate explicit same-lock forward repair first compares exact partial catalog state, records its own RUNNING/APPLIED checksum, retains/links the FAILED original and permits the later seed only after real postconditions.
- Real restricted identities/target and positive DUAL probes before exact ORA-00942/01031 migration-history read/write and cross-schema DDL-denial probes. Existing metadata must show CREATE SESSION only, no roles/direct grants or PUBLIC access to test/application objects. No connection failure counts as a denial. No temporary runtime DDL grant is made.

The ALTER-denial probe names the disposable test owner's registry and a nonce column, never the application owner. If an unexpected privilege permits it, the suite fails and retains the test-only state for operator inspection. It does not drop columns or modify shared grants automatically. Ordinary runtime schema CREATE TABLE denial is established by effective privilege inspection; the actual DDL probe targets the expressly disposable owner.

Installed test schema, reference rows and controlled failure/repair history are retained for inspection. They are intentionally not compatible with treating this schema as an application owner afterward. Re-running the clean-schema suite requires a separately reviewed genuinely empty test target; it never deletes history, clears business data, drops/recreates an owner or blindly ignores object-exists errors. Interrupted/failed fixtures require reconciliation using their recorded versions/checksums and actual catalogs. Pure test-plan construction is deterministic; no release migration file is edited by fixtures.

Use [test-owner preparation](../provisioning/README.md#step-07-owner-lock-and-disposable-tests) and [operator configuration](../../Docs/database/migration-guide.md). All connections/pools close in finally paths. Existing `pnpm test:oracle` remains Step 06 connectivity/privileges only and must not be reported as the full Step 07 suite. The actual suite and independent clean application-owner release now passed; [dated evidence](../../Docs/database/step07-verification.md) records the initial failure, explicit reconciliation and retained fixture state.

Fast tests include packages/migrations/src/_.test.ts and database/tests/unit/_.test.mjs. They use mocks/pure planning and are explicitly not Oracle evidence. `python database/verification/verify-step07-design.py` compares the restricted authored SQL format with the manifest and dictionary/register/index plan; it does not execute/compile SQL or split arbitrary scripts.

## Explicit first-run extended-string reconciliation

The 23 November first real run applied 000001-000007 and executed all resource DDL in 000008, then recorded FAILED because the catalog verifier did not recognize Oracle's internal LOB storage for VARCHAR2(2000 CHAR) on AL32UTF8 (DATA_LENGTH=8000). SQL/entry checksums were not changed. The corrected verifier accepts internal LOBs only for exact already-validated extended VARCHAR2 columns or declared LOB types; unexpected LOBs/indexes remain errors.

The explicit `--reconcile-extended-varchar-storage` option is restricted to exact SPORTIFY_TEST_OWNER and the existing disposable confirmation. It requires the exact first eight immutable history/checksum records (seven APPLIED, 000008 FAILED), no prior repair, and a complete exact catalog through 000008 before mutation. It appends an in-memory test-only 000012 repair with a checksummed PL/SQL no-op/catalog reconciliation, its own RUNNING/APPLIED lifecycle and full catalog postconditions; the original 000008 remains FAILED linked to that repair. No table/history is deleted, original is not relabeled APPLIED, and no production manifest entry is added. Normal runner checks then admit only 000009-000011.

This is a reviewed recovery for one observed disposable state, not a generic resume, error suppression or production recovery switch. A different/partly repaired state refuses before marker creation. Default invocation still requires an empty schema. Subsequent deliberate failure fixtures take versions 000013-000015 after this test-only repair. Preserve logs/history; do not rerun this one-shot recovery against its already-used target.

```sh
node --env-file="<protected-test-owner-env-file>" database/tests/oracle-migration-runner.mjs --reconcile-extended-varchar-storage
```

The initial failed invocation remains a failed result. Only actually completed reconciliation/continuation/component checks may be reported as passed; the application-owner release must still prove all 11 original phases from a clean schema.

23 November execution result: explicit reconciled full suite exited 0; all 33 integrity cases, seed/customization, concurrent DDL lock, controlled failure/repair and both real runtime-denial checks passed. Separate final catalog/history verification confirmed 15 rows, 13 APPLIED and retained repaired failures 000008->000012 and 000013->000015. Application owner independently applied all original 11 phases cleanly with no repairs and a repeat no-op. The used test owner remains retained, not eligible for another clean/one-shot invocation.

## Step 08 separate suite

Use test:oracle:step08 and a newly prepared SPORTIFY_STEP08_TEST_OWNER; keep the used Step 07 owner/repair history intact. New source fixtures and barrier-coordinated races live in step08/. They delete only their verified synthetic tenant roots/children and keep schema/reference/history. The new suite is prepared, not executed; D-21 policy approval is recorded, while explicit target/test-owner credentials/preflight gates are still required. [Current safety and commands](../../Docs/database/step08-verification.md).

D-22: the Step 08 target is now installed and its full suite passed. Normal invocation still requires an empty owner. The explicit `--reconcile-case-catalog` flag accepts only the exact original verifier-failure state or its verified linked repair, never a generic populated schema. It preserves FAILED 000017->APPLIED test-only 000018 and requires zero fixture/business rows before reuse. No application manifest repair entry or automatic clearing is added. [Actual results](../../Docs/database/step08-verification.md).

## Step 09 isolated integration suite

The explicitly invoked oracle-step09.mjs requires a globally approved 26-phase manifest before credentials/connection, designated target, exact fresh empty SPORTIFY_STEP09_TEST_OWNER, its own protected password, runtime verification credentials and isolated-disposable-empty confirmation. It checks exact prerequisites/grants/quota, migrations/repeat/catalog/seeds/checksum refusal, integrity and separate-session transaction/concurrency harnesses. It has no reset or general resume option and never clears used Step 07/08 history. The specific --reconcile-case-catalog flag accepts only the observed 000019 verifier failure or its exact linked clean state. Failed DDL remains recorded for deliberate reviewed recovery.

Synthetic plan/theme/feature codes and monetary values are fixtures, not commercial seeds. Shared venue roots defer their commit so new setup is one transaction. Cleanup verifies known tenant UUIDs and known platform record IDs/run markers, removes child-before-parent fixture rows and retains schema/reference/history. Partial setup rolls back. Real runtime denials follow successful identity/DUAL probes and must be ORA-00942/01031. [Exact operator commands and pending Oracle gates](../../Docs/database/step09-verification.md).

Unit tests in unit/step09-fixtures.test.mjs cover canonical synthetic fingerprinting, owner/scope replay checks, fixed owner boundaries and setup commit behavior only. They are not evidence that Oracle constraints, NULL uniqueness or locking work.

## D-24 explicit fixture inputs

Approved structural policies do not approve commercial/operating values. Fixture MAX_ATTEMPTS is a named synthetic test-only value sufficient for claim/reclaim. Builders explicitly supply budget and scheduling timestamps because production SQL has no defaults; missing budgets must fail with ORA-01400 in the real suite. Existing fixture plan/feature codes, amounts/limits/trial values and lease timestamps are synthetic inputs only, never seeds or application configuration. Current technical manifest holds must clear before the suite can connect; the application-owner release still waits for the complete isolated pass. No Oracle execution occurred during approval reconciliation.

## Step 09 observed subscription CASE recovery

Oracle expanded the original CASE WHEN status IN (...) index into equivalent simple CASE arms. The first isolated run retained FAILED 000019. The comparator now accepts only identical-return identifier arms with literal contents/order preserved and no ELSE/expression changes; regression tests reject semantic drift. The explicit recovery verifies exact source checksums, known history, full original catalog and zero business/fixture rows before writing. It records/links deterministic test-local 000027 and never rewrites SQL, marks the original failure APPLIED, clears history or affects another owner. It admits only the failed 19-entry prefix, its 20-entry linked prefix or the fully installed linked 27-record release. Unknown later partial failures require separate review. See the [executed/pending evidence](../../Docs/database/step09-verification.md). No general-purpose adoption or destructive reset is provided.

## Step 09 final actual result

The complete isolated suite exited 0 after the exact CASE recovery, including 53 integrity rejections, transaction/concurrency, cleanup and both runtime identity/DUAL/denial checks. One intermediate worker-verification failure and its standalone diagnostic were not counted as a complete pass; the following COMPLETE invocation passed unchanged credentials/grants. Actual installed state is 49 tables with 27 retained history records (FAILED 000019 linked to APPLIED 000027). Application installation used only original 26 entries and passed apply/repeat/catalog/status/history/count preservation. [Dated report](../../Docs/database/step09-verification.md). These are database/test-harness results; production processors/APIs remain unimplemented.
