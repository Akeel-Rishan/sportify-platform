# Accounts and privileges

## Step 10 disposable verification owners

CLEAN and UPGRADE each use the same narrow migration privileges and a separate credential. Only the uniquely named CLEAN transaction fixture is eligible for temporary SELECT and INSERT grants to the runtime users. The fixture is removed after those checks and subsequent denials check that no direct object grants remain. The Step 10 application privilege checks passed for both runtimes. [Operator setup](step10-operator-setup.md) ? [Live results](verification-report.md)

Step 06 provisioning scripts were initially delivered without live execution. On 22 November 2026, the user supplied a successful preparation and postcondition run after private Database Actions password setup; the owner has a 256 MB DATA quota and runtimes have none. Actual runtime identity/target connectivity and all 14 restricted-privilege metadata assertions subsequently passed; PUBLIC object-baseline review and destructive negative checks remain outside this evidence. The existing design's owner name `SPORTIFY_SCHEMA_OWNER` is retained. The prompt explicitly selects separate API and worker identities; the earlier illustrative `SPORTIFY_APP` is not used.

| Identity              | Purpose and current direct system privileges                              | Quota/current object grants                                  | Future grants and secret responsibility                                                                                                       |
| --------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| SPORTIFY_SCHEMA_OWNER | Controlled migrations only; CREATE SESSION, CREATE TABLE, CREATE SEQUENCE | Operator-approved finite DATA quota; no objects created here | Own-schema tables, identity sequences and indexes. Migration operator stores/rotates this credential separately; never loaded by applications |
| SPORTIFY_API          | API runtime; CREATE SESSION only                                          | No quota, roles, admin option or object grants               | Later reviewed per-object/column DML or wrapper EXECUTE for API duties; API operator stores/rotates only its runtime credential               |
| SPORTIFY_WORKER       | Worker runtime; CREATE SESSION only                                       | No quota, roles, admin option or object grants               | Later reviewed per-object/column grants for worker duties; worker operator stores/rotates its separate runtime credential                     |

ADMIN is used interactively by an authorized provisioner only. No application may use ADMIN, owner, DBA, RESOURCE, CONNECT role bundles, ANY privileges, UNLIMITED TABLESPACE, account-management privileges, grant option or blanket cross-schema access. Exact runtime names are validated, preventing accidental reuse of ADMIN/owner or the other runtime. PUBLIC's platform grants are target-specific; effective session privileges and administrator catalog review are required, not assumed safe.

CREATE TABLE plus finite quota supports the planned own-schema tables/indexes; CREATE SEQUENCE supports the NUMBER identity direction. No CREATE PROCEDURE/VIEW/TRIGGER/TYPE bundle is granted speculatively. If a later reviewed migration requires another capability, document its concrete object need and verify it on ATP first. Nothing executes a baseline or creates these objects here. See [official SQL prerequisites and operator sequence](../../database/provisioning/README.md). Exact ATP privileges, SQLcl authentication transition and quota behavior remain unverified until that sequence is executed on an authorized target.

Future grants belong to reviewed migrations for actual objects, with independent API/worker duty lists and negative-access tests. Use explicit `SPORTIFY_SCHEMA_OWNER.<reviewed object>` names. The owner identifier is fixed by an allowlist, not accepted as arbitrary SQL. `CURRENT_SCHEMA` is never changed; it would confer no privileges. Neither runtime receives migration-registry writes or temporary DDL rights for verification. The [runtime grant example](../../database/provisioning/runtime-grants.sql.example) is comments only.

## Step 07 current grants and owner locking

No implemented API/worker operation reads or changes the new history/reference objects: health/readiness still use DUAL and the worker is idle. **Actual runtime object grants remain none**. There is no blanket grant of every new table, no migration-history read/write authority, and no runtime lock capability. The comments-only runtime grant example therefore has no relevant executable grant to replace yet. Planned future API object DML/worker access requires the later approved operation matrix and actual implementation; connection success alone does not establish authorization.

The operator-only migration connection requires an approved usable DBMS_LOCK capability to hold a session lock across DDL commits. No package/system grant is performed by the runner. ATP restricts ADMIN grants on SYS-owned objects; capability must be verified on the actual service. If unavailable, stop for a supported narrow wrapper/fencing design, never add DBA/ANY or runtime lock rights. Existing Step 06 account postconditions describing an empty owner apply **before** migrations and are not an after-schema verification script. Later installed schemas use db:verify plus explicit grant tests. [Migration guide](migration-guide.md) documents the current gate.

## Step 07 actual capability and verification

The user executed the reviewed ADMIN grant of only SYS.DBMS_LOCK EXECUTE to SPORTIFY_SCHEMA_OWNER, without grant option. Actual owner locking across DDL commits/concurrent exclusion passed. The runner never grants privileges. The owner now contains the verified 26-table application release; old Step 06 zero-object/empty-schema postconditions are historical prerequisites, not installed-schema checks.

The separately provisioned SPORTIFY_TEST_OWNER independently passed authentication/target, exact CREATE SESSION/TABLE/SEQUENCE without admin option, no roles/column grants, only DBMS_LOCK EXECUTE, finite 256 MB DATA quota and initial empty-schema checks. It now retains its synthetic test schema/failure history, with no automatic clearing/recreation. Credentials remain outside applications/source.

Actual API/worker grants remain CREATE SESSION only, no object grants or runtime lock/DDL privileges. Both real identities passed positive DUAL checks before exact migration-history read/write/DDL denials in the disposable owner. Additional SELECT/non-mutating UPDATE denials against the installed application history passed. No artificial business grant was added merely to produce a positive test. All 20 permission codes are reference rows; staff assignments still require later authorized role logic. Future reviewed per-object grants must follow actual implemented duties.

[Complete execution and limits](step07-verification.md). Runtime credential separation/rotation recommendation and ADMIN PUBLIC baseline review remain separate; no secret or platform privilege was changed silently.

## Step 08 separate test owner and runtime access

Prepared SPORTIFY_STEP08_TEST_OWNER has the same narrow test-only prerequisites: CREATE SESSION/TABLE/SEQUENCE without admin option, finite 256 MB DATA quota and only SYS.DBMS_LOCK EXECUTE without grant option. The script initially creates it locked/NO AUTHENTICATION, refuses existing users and never resets/drops another identity. It is not provisioned yet. API/worker owner allowlists remain separate; only the operator parser admits this one exact new test identity.

Actual runtime object grants remain none, since no booking/payment/cleanup functionality exists. Planned expiry-worker access must later be limited to required hold/item/slot reads and conditional state/release writes; it receives no finance, migration history or DDL authority merely because those tables exist. [Step 08 safety/evidence](step08-verification.md).

D-22 verified the separate Step 08 test owner and both restricted runtime identities. API/worker still have CREATE SESSION only and no application/test object grant; migration-history read/write and test DDL denials passed after positive connectivity. The operator's test-owner provisioning did not grant runtime schema privileges. Keep migration/test secrets separate. [Actual evidence](step08-verification.md).

## Step 09 proposed owner and grant boundary

SPORTIFY_STEP09_TEST_OWNER is the sole new operator-only allowlisted identity for a fresh isolated suite. Preparation initially creates it locked without authentication, with CREATE SESSION/TABLE/SEQUENCE, finite 256 MB DATA quota and only SYS.DBMS_LOCK EXECUTE without admin/grant option. It refuses existing users and never resets/drops old owners. Scripts are prepared, not executed; its private configuration is separate and new password remains blank. Existing application/Step 07/08 owners, credentials and retained migration histories are preserved.

API/worker retain CREATE SESSION only and no new object grant: they still have no subscription, audit or job duty. Future reviewed audit emitters may receive INSERT only; subscription-payment/admin authority, dispatch/claim state updates and any retention process require separately approved per-object duties. No runtime UPDATE/DELETE audit, history, owner credential or DDL access is granted by this step. Planned tests require positive runtime identity/DUAL checks before exact denial codes. [Operator sequence and incomplete gate](step09-verification.md).

## D-24 approval reconciliation

Policy approval grants no new runtime object privileges. Existing Step 07/08 identities/grants and applied history remain unchanged. Exact Step 09 test-owner compatibility/provisioning/postcondition evidence is still required, followed by the isolated suite before application migration. No provisioning, password changes or Oracle connection occurred during this reconciliation. Undecided collection/retention/secret replay and numeric operating values do not authorize new processes or grants. [Current sequence](step09-verification.md).

## Step 09 actual provisioning and denials

The operator's exact Step 09 test-owner initial postconditions passed. Its isolated suite and both runtime identities passed actual checks. Additional API/worker verification after application installation proved identity/UTC DUAL success plus 17 exact Oracle access denials each, including all new table/history reads and audit INSERT/UPDATE/DELETE attempts with WHERE 1=0. No new runtime object grant or credential change occurred. Test-only CASE recovery is restricted to the Step 09 owner; application and older test owners are refused. [Actual evidence](step09-verification.md). Retention, commercial authority and later emitter/processor grants remain separately scoped.
