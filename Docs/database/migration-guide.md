# Step 07 migration guide

**Current scope is partial and review-gated.** The Step 07 prompt authorizes schema work, but the existing register still marks session/invitation, scheduling and permission-catalog proposals unapproved. Three explicit questions are pending. No agent has connected to Oracle, applied migrations, provisioned accounts or run destructive fixtures. [Implemented SQL inventory](implemented-schema.md) distinguishes existing artifacts from pending design/application work.

## One ledger and phased artifacts

The scoped Step 07 prompt excludes bookings, payments, subscriptions, website and job/outbox structures. It therefore supersedes the Step 05 recommendation of a single 54-table baseline with small phases in the **same** SCHEMA_MIGRATIONS ledger. The original uploaded broad bootstrap and its `1.0.0`/`BOOTSTRAP-001` marker are never executed or registered. No competing history is introduced.

`database/migrations/manifest.json` is the explicit reviewed inventory. Each entry has a six-digit contiguous version, stable name, schema/seed kind, ordered files and postcondition metadata. SQL files are one statement each, UTF-8/LF without BOM or terminators; PL/SQL files retain complete BEGIN/DECLARE ... END; blocks, without SQLcl slash lines. One file is one driver execute call. No generic SQL parser or semicolon splitter is used. SQLcl SET/WHENEVER commands do not belong in driver artifacts. The restricted SQL form accepts CREATE TABLE/INDEX, ALTER TABLE, MERGE and INSERT; it rejects SQL terminators, top-level DROP/TRUNCATE and noncanonical files. This is a restricted format for trusted, reviewed artifacts, not a SQL sandbox or Oracle syntax validation.

Paths must remain within the database directory after realpath resolution; duplicate files, traversal, version gaps, oversized files and invalid metadata are rejected before mutation. `.gitattributes` pins authored migration/seed SQL and the manifest to LF without changing uploaded sources. A migration checksum is SHA-256 over length-prefixed UTF-8 values: recursively key-sorted JSON for that entry's authored metadata, then every SQL file's exact bytes in declared order. Global review status and later entries do not change a prior checksum. Editing an applied entry's name, expected schema or SQL stops execution. Preserve the original release artifacts/checksums; never normalize or rewrite applied files.

## Commands and gates

From the root, use the pinned pnpm fallback if needed:

```sh
npx --yes pnpm@10.34.9 db:plan
npx --yes pnpm@10.34.9 db:status
npx --yes pnpm@10.34.9 db:migrate
npx --yes pnpm@10.34.9 db:verify
```

`db:plan` loads/hashes local files only and prints `oracleValidated:false`; it neither connects nor claims pending versions on a particular database. `db:status` requires an explicitly selected target and reports its history/pending list, not catalog verification. `db:migrate` and `db:verify` refuse `status:review` or nonempty `blockedBy` **before connecting**. Do not edit this gate merely to bypass the unresolved decisions. Approval must be recorded in the decision register and the missing approved schema/seed artifacts completed before marking the release ready.

Operator commands build project-local compiled JavaScript and use process environment only, never application .env files. Supply owner credentials only to a dedicated migration command/terminal, not to API/worker processes or their environment files. Build first before securely injecting credentials when the secret mechanism permits process-scoped injection. Never put passwords/descriptors in command arguments, chat or logs.

| Operator variable               | Required meaning                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------- |
| ORACLE_MIGRATION_CONFIRM        | Exact `designated-development`; explicit selected development/pilot target        |
| ORACLE_MIGRATION_DB_UNIQUE_NAME | Exact expected database unique name, checked against SYS_CONTEXT after connection |
| ORACLE_MIGRATION_SCHEMA         | SPORTIFY_SCHEMA_OWNER, or isolated SPORTIFY_TEST_OWNER for explicit tests         |
| ORACLE_MIGRATION_USER           | Must exactly equal the selected owner, never ADMIN/API/worker                     |
| ORACLE_MIGRATION_PASSWORD       | Protected migration-only database password                                        |
| ORACLE_CONNECT_STRING           | Option-free TCPS host:port/service from this target's mTLS information            |
| ORACLE_WALLET_DIRECTORY         | Absolute protected instance-wallet directory outside the checkout                 |
| ORACLE_WALLET_PASSWORD          | Separate protected wallet decryption password                                     |

The owner connection checks SESSION_USER, CURRENT_SCHEMA and DB_UNIQUE_NAME before session changes or lock allocation. It requires Oracle 19c-or-later and AL32UTF8, sets UTC and DDL_LOCK_TIMEOUT=10. Driver connect/transport timeouts are 5s/3s, retries zero, callTimeout 30s per round-trip. These are operation budgets, not a proven whole-command/DNS deadline. No CURRENT_SCHEMA shortcut is used; unqualified migration names resolve only in the verified owner schema. Runtime application SQL still needs explicit schema qualification.

## Single runner and history

The same dedicated owner connection allocates `SPORTIFY_MIGRATIONS:<owner>`, requests DBMS_LOCK exclusive mode with a 10-second wait and `release_on_commit => FALSE`, executes every DDL/seed/history statement, and releases the handle in finally. No row-lock fallback, second execution connection or CI-only mutex is used. ALLOCATE_UNIQUE commits; it runs before migration DML, never in an application transaction. Exact lock return codes are checked. The owner must already have an approved usable DBMS_LOCK capability on the actual ATP service; **this has not been verified**. ADMIN's ability to grant rights on SYS-owned packages is restricted on ATP. Do not copy broad grants or grant lock access to runtimes. If the selected service cannot support this mechanism, stop and review a supported narrowly scoped wrapper or external fencing design; this implementation never silently substitutes another lock.

For an empty owner, 000001 explicitly creates SCHEMA_MIGRATIONS, commits a RUNNING row, then adds its self-FK/index and verifies postconditions. A crash between table creation and row commit leaves an unknown registry; it is refused and requires reconciliation. Any populated schema without the recognized ledger, unknown version, gap, duplicate record, changed checksum or unreconciled RUNNING/FAILED state stops execution. A preexisting empty registry is not silently adopted.

Each migration commits its RUNNING marker before work, preserves explicit step IDs/checksums in safe events, verifies catalog/seeds, then commits APPLIED with completion/install time and duration. Seed DML and its APPLIED transition share the final transaction. DDL can commit independently; a later error does not roll it back. Failure stops subsequent entries, rolls back unfinished DML, and attempts a FAILED transition with a fixed ERROR_CODE. Logs say whether that transition was acknowledged; a failed history write or lost commit acknowledgement requires inspection, not a claim that rollback restored the schema. No arbitrary write/COMMIT retry is performed.

## Verification and forward-fix recovery

Catalog comparison checks exact table/column sets, types/character semantics, nullability/defaults and identity generation; named PK/UK/FK/check definitions, parent keys/owner, enabled/validated/immediate state and NO ACTION deletion; valid indexes, expressions/uniqueness and declared LOB backing objects; invalid-object absence and natural-key seed presence. Comparisons are unit-tested but actual Oracle formatting/metadata behavior is an outstanding live gate. A passing plan/mock is never schema execution evidence.

On failure retain artifacts, checksums and RUNNING/FAILED history; inspect actual USER_* catalogs with the authorized operator. Do not rerun bootstrap, suppress object-exists errors, delete history, label a failed original APPLIED, drop the owner or clear application data. An operator must reconcile exact partial state and author/review a new numbered forward-fix artifact with `repairOf` referencing the failed version. Execute a repair only through a separately reviewed same-session SQLcl/driver procedure under the identical advisory lock, with an explicit expected partial-state manifest, original checksum and new repair checksum. Record its own RUNNING/APPLIED lifecycle only after real postconditions, then link the retained FAILED row's REPAIR_VERSION. Ordinary migration commands **do not execute repair entries automatically**.

The planner admits a repaired failure only when the linked repair is a known APPLIED entry with matching checksum, a later version and the matching repairOf declaration; cycles/chains/orphan repairs and failed/running repairs stop. Before any later normal migration, the complete applied/repaired catalog is checked again. There is no automatic repair/resume command or unreviewed partial-state script here. A failed repair requires another explicit recovery review or a verified restore; never improvise a success marker. Disposable schema recreation likewise requires separate destructive authorization, not this command.

## Official evidence consulted

20 November 2026: [Oracle 19c DBMS_LOCK return codes and session lock lifetime](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_LOCK.html), [Oracle 26 DBMS_LOCK allocation commits](https://docs.oracle.com/en/database/oracle/oracle-database/26/arpls/DBMS_LOCK.html), [ATP ADMIN grant restrictions](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/autonomous-admin-user-roles.html), [index types/status and uniqueness metadata](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/ALL_INDEXES.html), [identity generation metadata](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/ALL_TAB_IDENTITY_COLS.html), and the existing [26.0.0 driver/mTLS evidence](secure-connectivity.md). These establish the implementation's intended protocol, not proof of this target's capabilities.
