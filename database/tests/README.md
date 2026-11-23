# Explicit Step 07 Oracle testing

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
