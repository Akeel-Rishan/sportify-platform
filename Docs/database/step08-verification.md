# Step 08 executed Oracle verification, 23 November 2026

**Step 08 engineering/Oracle gate passed; awaiting user verification.** D-21's three policy groups remain approved. The complete isolated suite passed after the verifier/test-harness corrections recorded below. Application migrations 000012-000017 then applied cleanly, repeated with no changes and passed exact catalog verification. No Step 09, booking/payment service, API, worker job, UI, commit, push or deployment is included.

## Installed scope and history

| Version | Tables added                                      | Application result |
| ------- | ------------------------------------------------- | ------------------ |
| 000012  | CUSTOMERS                                         | APPLIED            |
| 000013  | BUSINESS_PAYMENT_SETTINGS                         | APPLIED            |
| 000014  | BOOKING_HOLDS, BOOKING_HOLD_ITEMS                 | APPLIED            |
| 000015  | BOOKINGS, BOOKING_ITEMS                           | APPLIED            |
| 000016  | RESOURCE_SLOT_RESERVATIONS, BOOKING_CANCELLATIONS | APPLIED            |
| 000017  | PAYMENTS, REFUNDS                                 | APPLIED            |

Reuse existing LOCATIONS, RESOURCES, RESOURCE_FEATURES, OPERATING_HOURS, HOLIDAYS, AVAILABILITY_BLOCKS and PRICING_RULES. No old table recreation, backfill or applied SQL rewrite. Step 08 delta: ten tables/135 columns/114 named constraints/37 explicit indexes. Combined actual catalog: **36 tables, 394 columns, 320 named constraints, 67 explicit indexes**, no invalid objects, eight sports and 20 permissions. All business/fixture tables are empty in application and Step 08 test owners. PAYMENT_TRANSACTIONS, gateways, subscriptions, outbox/jobs and recurrence remain excluded. No new runtime object grant.

Application SPORTIFY_SCHEMA_OWNER history is exactly original 000001-000017 APPLIED, no repair, no pending/RUNNING/FAILED entries. The status command intentionally says catalogVerified:false because status itself is not verification; the separate verify command exited 0. All 17 source checksums are immutable after installation.

Step 08 SPORTIFY_STEP08_TEST_OWNER retains 18 records: original 000001-000016 APPLIED, original 000017 FAILED linked to APPLIED test-only 000018. Never relabel/delete that failure. The repair is not in the application manifest/history. Independent read-only audit also confirms the old SPORTIFY_TEST_OWNER retains its 15 Step 07 records, including FAILED 000008->000012 and 000013->000015, with no RUNNING record. No old test schema/data was cleared.

## Actual isolated results

- Operator created/authenticated the new separate test account privately. Identity/known development target/AL32UTF8/UTC, exact CREATE SESSION/TABLE/SEQUENCE, only SYS.DBMS_LOCK EXECUTE, no roles/column grants, finite 256 MB DATA quota and initial empty state passed before mutations. No ADMIN/runtime credential was used as the migration owner.
- All original DDL executed. Exact catalog verification, same-checksum repeat/no-op and deliberate applied-checksum-change refusal passed following the explicit recovery below.
- **40 exact Oracle rejection cases passed**, plus positive booking/hold ownership, independent tenants/resources, half-open occupancy, PENDING_PAYMENT, zero-total PAID/no artificial receipt, excluded financial history and restrictive cancellation/payment/refund deletion. Expired-hold physical keys remained protected. Wrong-tenant header references may fail either of the two applicable named FKs; only those known names and ORA-02291 are accepted.
- **A-E real separate-session races passed:** one same-slot winner; rollback allowing the waiting writer; overlapping complete intervals with all loser inserts rolled back; independent resources directly and through the approved coarse locking protocol; atomic hold-to-booking conversion and rollback preserving all protected slots. Coordinator cannot see the first writer's uncommitted reservations. Database-side barriers use bounded waits, not sleeps.
- Both API/worker identities passed positive identity/target/DUAL and connection reuse checks, CREATE SESSION-only verification, and exact ORA-00942/01031 denials for test migration-history read/write and DDL. No runtime DDL grant was added for testing.
- Known synthetic roots/children were removed by guarded cleanup; schema, references and history remain. Post-cleanup catalog, zero business-row counts, no invalid objects and closed connection/pool lifecycle passed. No application business record was used as a fixture.

## Initial failures and explicit recovery

The first invocation did not pass cleanly. Oracle created all 36 tables and both conditional finance indexes, then its catalog exposed single-equality CASE indexes as `CASE status WHEN 'value' THEN id END`; the verifier expected searched CASE. It retained FAILED 000017 with its original checksum. The production comparator now normalizes only one identifier/string-literal/identifier arm without ELSE, preserving literal case/content and rejecting changed branches/values. Unit tests cover actual captured spelling and semantic drift. No SQL or constraint was relaxed or rewritten.

The explicit `--reconcile-case-catalog` path requires only SPORTIFY_STEP08_TEST_OWNER and the exact observed 16-APPLIED/one-FAILED history, all matching checksums, full original catalog and zero business rows. It records deterministic test-only 000018, verifies again, and atomically commits its APPLIED state plus the original FAILED link. A subsequent run accepts only this exact already-linked state and empty fixture data. Unknown/partial/history states stop; no general repair/adoption/drop/recreate/ledger clearing exists.

Later fixture runs exposed three test-harness issues: assuming the report order between two violated tenant/header FKs, Oracle rejecting the bind name `:resource` (renamed `:resourceId`), and a zero-wait contender colliding with the observer's temporary marker probe. The contender now waits at most five seconds for that marker; observer probes remain nonblocking and bounded. Failed fixture runs cleaned known synthetic records and retained history. The final complete invocation exited 0, including integrity, A-E races, cleanup and runtime denials. A diagnostic concurrency-only pass is separate evidence and was not substituted for the full suite.

## Enforcement layers

| Invariant                   | Verified SQL structure                                                                  | Test/future responsibility                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One occupied slot           | PK (TENANT_ID,RESOURCE_ID,SLOT_START_UTC), all NOT NULL                                 | Actual separate-session uniqueness and rollback/waiter races passed                                                                                                    |
| Exactly one owner           | Explicit booking-item XOR hold-item CHECK                                               | Ownership conversion updates both columns together; failed transaction must retain protection                                                                          |
| Same resource/tenant owner  | Composite item FKs include TENANT_ID/item ID/RESOURCE_ID, backed by exact parent UKs    | Trusted scope/authorization remains future application logic                                                                                                           |
| Slot grid                   | MINUTE modulo 15 plus EXTRACT SECOND=0 rejects seconds/fractions                        | Colombo-first local-to-UTC policy; no claim this supports every international local grid                                                                               |
| Half-open complete coverage | Row PK does not prove interval containment or all required slots                        | Fixture utility uses [start,end); production transaction must insert/verify every service+buffer slot atomically                                                       |
| Hold conversion uniqueness  | Existing source UX_BOOKINGS_SOURCE_HOLD conditional unique index                        | Both index expressions null for manual bookings; multiple null-source bookings remain valid                                                                            |
| Expiry/state                | Static allowed values and expiry-after-created                                          | Expired hold rows still protect keys until safe release; no time-dependent CHECK/trigger/job                                                                           |
| Cancellation/history        | Tenant-safe FK, one cancellation per booking, restrictive deletion                      | Cancellation releases only owned slots in an authorized transaction; no automatic refund                                                                               |
| Finance integrity           | NUMBER(12,2), positive receipts/refunds, currency FK chain, void metadata and actor FKs | Decimal input scale/range validation, full-payment/refund policy, aggregate caps and summary projection need locked transactions                                       |
| Refund booking identity     | REFUNDS has only tenant/payment/currency FK; booking derives through payment            | No independently editable refund BOOKING_ID exists; a redundant wrong-booking tuple test is inapplicable                                                               |
| Pricing                     | Reuse resource/effective-period/currency/rate model                                     | Approved recommendation uses one start-time hourly rate; no peak/dynamic priority framework invented. Ambiguous overlaps/precedence require approved transaction logic |
| Runtime grants              | No new grants: current runtimes still use DUAL only                                     | Future booking/expiry services must receive separately reviewed narrow per-object access                                                                               |

BOOKINGS.PAYMENT_STATUS is reserved as a future transaction-maintained projection of nonvoid RECEIVED payments and PROCESSED refunds, not a second independently editable ledger. D-21 accepts the precise P/R/T calculations and refund precedence in financial-rules.md. CK_BOOKINGS_ZERO_PAYMENT requires PAID for zero totals, and the new finance indexes bound effective successful-record cardinality. They do not prove full amounts or caps. Row CHECKs do not enforce cross-row totals, immutable history changes or authorization.

## Executed commands and local checks

From the repository, with credentials loaded only into these operator child processes:

```powershell
npx --yes pnpm@10.34.9 build:packages
node --env-file="C:/Users/ROG STRIX G15/.sportify-secrets/oracle-step08-tests.env" database/tests/oracle-step08.mjs --reconcile-case-catalog
# Only after that complete isolated invocation exited 0:
node --env-file="database/provisioning/migrations.env" infra/scripts/database-migrate.mjs
node --env-file="database/provisioning/migrations.env" infra/scripts/database-migrate.mjs
node --env-file="database/provisioning/migrations.env" infra/scripts/database-verify.mjs
node --env-file="database/provisioning/migrations.env" infra/scripts/database-status.mjs
```

Application apply returned exactly 000012-000017; repeat returned applied:[]; verify exited 0; status returned 17 APPLIED and pending:[]. Independent three-owner read-only history/catalog/count audit passed. No further provisioning or migration action is required for Step 08. Do not rerun account preparation or normal empty-owner suite against the used test schema. Only the exact guarded recovered state supports the flag above; future test history must be preserved.

Final pnpm check passed formatting, zero-warning lint, strict types, **22 files / 201 unit and HTTP tests** and all production builds. Coverage passed configured gates: **90.11% statements, 83.8% branches, 89.3% functions, 92.19% lines**. Coverage follows production-source inclusion and is not Oracle test coverage. Scoped Step 07/08 and broader dictionary/FK/index/ERD/link checks are distinct static evidence. Original 11 entry metadata/96 SQL-seed byte hashes and all newly installed source checksums remain unchanged. Generated declarations/logs/build output/wallets/private environment files remain outside committed source; final source scan found no configured credential matches.

## Remaining limits and user verification

No Step 08 Oracle blocker remains. Review the installed inventory/history and this retained failure/recovery record. SQL constraints do not implement complete slot coverage, cross-row amount equality/caps, legal lifecycle transitions, snapshot immutability, authorization, idempotency, maintenance coordination or production expiry/cancellation/refund services. Those stay in their later authorized application steps. No capacity/query-plan/ARM64/deployment/remote-outage/commercial-readiness claim. Step 08 awaiting user verification; stop before Step 09.

Official references: [Oracle CASE semantics](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CASE-Expressions.html), [conditional unique indexes](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-INDEX.html), [row locking](https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/transaction-processing-and-control.html), [DBMS_LOCK](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_LOCK.html), [node-oracledb 26 timeouts/cleanup](https://node-oracledb.readthedocs.io/en/v26.0.0/user_guide/connection_handling.html).
