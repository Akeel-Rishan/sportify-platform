# Step 07 migration guide

**D-18 approves the scoped Step 07 release and all 20 permission codes.** The manifest is ready with no outstanding structural/catalog blockedBy entries. The designated owner/test identity/lock/migration/catalog/integration gates now passed; future invocations still require protected configuration and all safety checks. [Dated executed evidence](step07-verification.md) records the initial test failure and retained explicit repair. See [SQL inventory](implemented-schema.md) and [current verification record](oracle-verification.md).

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

`db:plan` loads/hashes local files only and prints `oracleValidated:false`; it neither connects nor claims pending versions on a particular database. `db:status` requires an explicitly selected target and reports its history/pending list, not catalog verification. `db:migrate` and `db:verify` refuse `status:review` or nonempty `blockedBy` **before connecting**. Do not edit this gate merely to bypass the unresolved decisions. D-18 now records that explicit scoped approval; the ready release still enforces all target, owner, history and lock checks.

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

## Protected owner configuration and lock capability

Use a dedicated operator terminal and a protected file outside the checkout, based on `database/provisioning/migrations.env.example`. The preferred private file is in the user's `.sportify-secrets` directory. An ignored repository-local operator file may be used only for explicit operator commands and is never loaded by applications. Configuration is validated without printing secrets; only known target/wallet fields are copied from the designated runtime configuration, and the separately supplied owner password is preserved. Enter the existing schema-owner password privately, never in chat, command arguments, API/worker files or a tracked example. The file ACL was restricted to the current user, SYSTEM and Administrators. No test-owner credential or schema is assumed to exist.

Build packages before injecting owner secrets, then use Node's supported explicit environment-file option (replace the path):

```sh
pnpm build:packages
node --env-file="<absolute-protected-owner-env-file>" infra/scripts/database-status.mjs
node --env-file="<absolute-protected-owner-env-file>" infra/scripts/database-lock-check.mjs
# Only after decisions, artifact review and a ready release:
node --env-file="<absolute-protected-owner-env-file>" infra/scripts/database-migrate.mjs
node --env-file="<absolute-protected-owner-env-file>" infra/scripts/database-verify.mjs
```

Node 22.22.0 supports `--env-file`; existing process environment takes precedence. This option loads the explicitly named operator file, never application .env files. Root `db:*` commands remain available when a protected provider injects the same process environment. `db:plan` needs no credential file. Do not put the owner env-file option into global NODE_OPTIONS or API/worker launch commands. [Node 22 documentation](https://nodejs.org/download/release/v22.21.0/docs/api/cli.html#--env-filefile) records this option as nonexperimental from 22.21.0.

`db:lock-check` verifies owner identity/target/charset and acquires/releases one session lock. ALLOCATE_UNIQUE can create server lock metadata and commit; this is **not** a claim of a completely read-only operation, DDL lifetime or concurrent-runner proof. No business SQL is executed. If direct owner EXECUTE on SYS.DBMS_LOCK is needed, an ADMIN operator reviews the narrow `migration-lock-grants.sql` procedure; the runner never grants it. No role bundle, ANY privilege, grant option or runtime lock grant is permitted. Actual service support remains unverified until this command succeeds; failures must not trigger a weaker lock fallback. [Oracle's DBMS_LOCK security guidance](https://docs.oracle.com/en/database/oracle/oracle-database/26/arpls/DBMS_LOCK.html) recommends limiting EXECUTE to specific identities; this is not proof that ATP ADMIN can grant it on this target. The previously consulted DMS preparation URL now redirects to general target preparation and does not establish this capability. Actual service-specific grant/execute acceptance remains an explicit gate.

For live integrity/failure tests, an ADMIN separately prepares exact SPORTIFY_TEST_OWNER using the [reviewed test-owner sequence](../../database/provisioning/README.md#step-07-owner-lock-and-disposable-tests). Use `test-migrations.env.example` in another protected file, supply that test owner's password plus the two actual runtime passwords, set the designated target and explicit isolated-disposable-empty confirmation, then run:

```sh
node --env-file="<absolute-protected-test-owner-env-file>" database/tests/oracle-migration-runner.mjs
# Equivalent root entry with externally injected configuration:
pnpm test:oracle:step07
```

No real secrets are in either tracked example. Missing any required test identity/credential fails before owner mutation. The suite retains its disposable installed schema and controlled failure/repair history, and never automatically recreates/clears an existing schema. See [fixture/denial safety and test scope](../../database/tests/README.md). D-18 approval and the existing designated target's live gate now passed; future targets still require all explicit prerequisites.

## Single runner and history

The public owner-session helper revalidates even JavaScript callers against the owner-only allowlist before wallet access/connection. The same dedicated owner connection allocates `SPORTIFY_MIGRATIONS:<owner>`, requests DBMS_LOCK exclusive mode with a 10-second wait and `release_on_commit => FALSE`, executes every DDL/seed/history statement, and releases the handle in finally. No row-lock fallback, second execution connection or CI-only mutex is used. ALLOCATE_UNIQUE commits; it runs before migration DML, never in an application transaction. Exact lock return codes are checked. The owner must already have an approved usable DBMS_LOCK capability on the actual ATP service; **the operator has supplied the narrow grant and actual owner acquisition/release now passes**. ADMIN's ability to grant rights on SYS-owned packages is restricted on ATP. Do not copy broad grants or grant lock access to runtimes. If the selected service cannot support this mechanism, stop and review a supported narrowly scoped wrapper or external fencing design; this implementation never silently substitutes another lock.

For an empty owner, 000001 explicitly creates SCHEMA_MIGRATIONS, commits a RUNNING row, then adds its self-FK/index and verifies postconditions. A crash between table creation and row commit leaves an unknown registry; it is refused and requires reconciliation. Any populated schema without the recognized ledger, unknown version, gap, duplicate record, changed checksum or unreconciled RUNNING/FAILED state stops execution. A preexisting empty registry is not silently adopted.

Each migration commits its RUNNING marker before work, preserves explicit step IDs/checksums in safe events, verifies catalog/seeds, then commits APPLIED with completion/install time and duration. Seed DML and its APPLIED transition share the final transaction. DDL can commit independently; a later error does not roll it back. Failure stops subsequent entries, rolls back unfinished DML, and attempts a FAILED transition with a fixed ERROR_CODE. Logs say whether that transition was acknowledged; a failed history write or lost commit acknowledgement requires inspection, not a claim that rollback restored the schema. No arbitrary write/COMMIT retry is performed.

## Verification and forward-fix recovery

Catalog comparison checks exact table/column sets, types/character semantics, nullability/defaults and identity generation; named PK/UK/FK/check definitions, parent keys/owner, enabled/validated/immediate state and NO ACTION deletion; valid indexes, expressions/uniqueness and declared LOB backing objects; invalid-object absence and natural-key seed presence. Comparisons are unit-tested and passed on the actual designated Oracle catalog, including corrected extended-string internal LOB handling. A passing plan/mock is never schema execution evidence.

On failure retain artifacts, checksums and RUNNING/FAILED history; inspect actual USER_* catalogs with the authorized operator. Do not rerun bootstrap, suppress object-exists errors, delete history, label a failed original APPLIED, drop the owner or clear application data. An operator must reconcile exact partial state and author/review a new numbered forward-fix artifact with `repairOf` referencing the failed version. Execute a repair only through a separately reviewed same-session SQLcl/driver procedure under the identical advisory lock, with an explicit expected partial-state manifest, original checksum and new repair checksum. Record its own RUNNING/APPLIED lifecycle only after real postconditions, then link the retained FAILED row's REPAIR_VERSION. Ordinary migration commands **do not execute repair entries automatically**.

The planner admits a repaired failure only when the linked repair is a known APPLIED entry with matching checksum, a later version and the matching repairOf declaration; cycles/chains/orphan repairs and failed/running repairs stop. Before any later normal migration, the complete applied/repaired catalog is checked again. There is no automatic production repair/resume command or unreviewed partial-state script here. The disposable test helper contains one explicit reviewed fixture-specific recovery procedure with exact partial/full catalog comparisons; it is never an application recovery shortcut. A failed repair requires another explicit recovery review or a verified restore; never improvise a success marker. Disposable schema recreation likewise requires separate destructive authorization, not this command.

## Official evidence consulted

20 November 2026: [Oracle 19c DBMS_LOCK return codes and session lock lifetime](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_LOCK.html), [Oracle 26 DBMS_LOCK allocation commits](https://docs.oracle.com/en/database/oracle/oracle-database/26/arpls/DBMS_LOCK.html), [ATP ADMIN grant restrictions](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/autonomous-admin-user-roles.html), [index types/status and uniqueness metadata](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/ALL_INDEXES.html), [identity generation metadata](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/ALL_TAB_IDENTITY_COLS.html), and the existing [26.0.0 driver/mTLS evidence](secure-connectivity.md). These establish the implementation's intended protocol, not proof of this target's capabilities.

22 November 2026 recheck: the DBMS_LOCK package reference confirms allocation commits, session lock behavior and restricted EXECUTE guidance. The Node 22.21 CLI reference confirms explicit env-file support and process-environment precedence; local execution uses pinned Node 22.22.0. Target-specific grant/lock behavior remains unexecuted.

## Historical D-18 connectivity checkpoint

The designated owner status check succeeded with an empty schema and all 11 versions pending. Configuration is valid, with no owner password changed. Owner lock allocation currently fails ORA-06550/PLS-00201 and metadata shows no direct SYS.DBMS_LOCK grant; run the prepared narrow ADMIN grant procedure and verify capability before any migration. The private disposable test file is prepared with an empty test-owner password. No migration/provisioning/grant was executed by this continuation. Step 08 remains blocked until actual Step 07 integration evidence is complete.

## Historical operator lock-grant follow-up

The user executed migration-lock-grants.sql successfully as ADMIN. Independent compiled owner lock acquisition/release/cleanup passed; metadata confirms one direct grant, while the application schema/history remains empty and all 11 versions are pending. A read-only check confirms SPORTIFY_TEST_OWNER is absent. Prepare/authenticate/verify that separate owner with the reviewed scripts before running its full isolated suite; no application schema, fixture or test owner is created by this follow-up. DDL-commit/concurrent lock proof remains a real-suite gate.

## Oracle extended-string catalog correction and explicit disposable repair

The first real disposable run discovered internal LOB storage on RESOURCES.DESCRIPTION, declared VARCHAR2(2000 CHAR), DATA_LENGTH=8000 on AL32UTF8. [Oracle's extended data type documentation](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Data-Types.html) explains that extended VARCHAR2 storage uses LOB technology. Exact column type/length validation still runs before the internal LOB allowance; unexpected columns/LOBs/indexes are still rejected. No release SQL/checksum is edited for this driver/catalog correction.

000008's failed record is retained and can be reconciled only by the [explicit disposable procedure](../../database/tests/README.md#explicit-first-run-extended-string-reconciliation), which requires exact actual full catalog and history and records/links its own checksummed test-only repair. It is excluded from the application manifest; application-owner installation uses the original 11 migrations. This observed failure is not evidence of clean all-phase application until that separate run succeeds.

## Step 07 final execution record

All 11 original versions applied cleanly to the application owner, repeated with no changes and passed exact verification. The full disposable suite passed after explicit retained-state reconciliation of the verifier-only initial failure. Its test-only repairs are absent from the application manifest/history. The used test owner is intentionally retained and must not be treated as empty or re-provisioned automatically. See [complete results and commands](step07-verification.md). Step 07 awaits user verification; do not start Step 08 automatically.
