# Oracle verification gates

## Step 10 foundation gate

The Oracle foundation gate **passed on 27 November 2026** after the successful clean install and verified continuation on both disposable owners. The final audit showed zero remaining business fixture rows and temporary runtime grants. The application catalog and installed history verification also passed. [Evidence matrix](verification-report.md) · [Operator setup and retained state](step10-operator-setup.md)

## Step 09 Oracle gate passed

23 November 2026. The complete isolated suite passed 53 integrity cases, transaction/concurrency, cleanup and runtime denials after the documented narrow CASE metadata correction/retained test-only repair. Only then did application 000018-000026 apply cleanly, repeat no-op and pass standard verify/status and independent catalog/history/table-count checks. Application: 26 APPLIED/no repairs/pending, 49 tables, 569 columns, 463 constraints, 101 explicit indexes and zero invalid objects. Additional actual application denials passed for API/worker. Previous Step 07/08 records/checksums/counts remain unchanged; all excluded configuration remains unseeded. [Dated execution/failure/recovery evidence and limits](step09-verification.md). Step 09 awaiting user verification; no Step 10.

## Step 09 compatibility confirmed by operator

23 November 2026. User-supplied SQLcl results confirm fce953xa / ADMIN and V$PARAMETER.COMPATIBLE=23.5.0. This supersedes the earlier restricted-owner access failure as the current compatibility result. Only the compatibility hold is cleared; test-owner provisioning/postconditions, isolated migration/integrity/concurrency and application verification remain pending. The agent did not reconnect or perform Oracle mutations. [Current staged report](step09-verification.md).

## D-24 approval reconciliation; Oracle checks still blocked

Three Step 09 policy approvals are recorded. This reconciliation made no Oracle connection, grant, migration or fixture call. COMPATIBLE confirmation and exact fresh test-owner postconditions are still missing; complete isolated-suite success is required before application release. Earlier baseline server/JSON predicates and Step 07/08 results remain scoped historical evidence, not a new pass. Manifest review now records technical holds, not unanswered policy questions. [Current report and staged commands](step09-verification.md).

## Historical Step 09 gate before D-24, 23 November 2026

**BLOCKED for new Step 09 DDL/integrity/concurrency.** Existing Step 08 owner/catalog/status verification passed as a baseline before editing. Server reports 23.26.4.1.0; strict unique-key JSON predicate probe on DUAL passed, but restricted-owner V$PARAMETER access was denied and actual COMPATIBLE remains unknown. No new table/constraint was executed. Three new policy approvals and a fresh SPORTIFY_STEP09_TEST_OWNER/private initial password are required. No earlier Oracle pass is relabeled as Step 09. [Exact evidence and remaining commands](step09-verification.md). Historical records below remain scoped to their dated steps.

**Live status, 22 November 2026: operator provisioning and actual runtime connectivity/metadata privileges/HTTP readiness passed.** The user supplied passing ADMIN preparation and account postconditions, including a finite 256 MB owner DATA quota, then completed initial passwords privately in Database Actions. The agent subsequently verified both restricted runtime identities against the designated target with node-oracledb 26.0.0 Thin mTLS, UTC/exact-value behavior, real-pool HTTP readiness and compiled worker lifecycle. Replacement-wallet decryption succeeded. These results do not establish business schema, persistent transactions, remote outage recovery, POSIX signal handling, Linux ARM64 or commercial readiness; Windows Ctrl+C entry-point checks are recorded in the acceptance audit below. PUBLIC object-grant baseline review remains pending; no migrations or cloud/network changes were executed.

## Initial 22 November runtime attempt (superseded)

The API/worker dependency-ordered production build passed. With both runtime configurations validated and secrets supplied only in child-process environment, the existing compiled connectivity tool exited 1 before any successful identity/target result. A bounded direct API diagnostic returned only NJS-505; an offline TLS-context initialization using the same PEM/passphrase returned ERR_OSSL_BAD_DECRYPT. No raw errors, passwords, wallet material or descriptors were logged. This identifies wallet-key decryption as the immediate blocker; it does not establish whether either runtime database password is correct. The two runtime database-password fields also currently match; separate passwords remain recommended. No secret was changed by the agent.

The walletPassword setting must be the password chosen when downloading this specific instance wallet, as documented in [node-oracledb 26.0.0 mTLS setup](https://node-oracledb.readthedocs.io/en/latest/user_guide/connection_handling.html#connecting-with-node-oracledb-thin-mode-using-mtls). Correct it privately in both application configurations. If unavailable, obtain a new protected instance-wallet download/password pair through the authorized operator; do not reset database accounts or disable TLS verification to bypass this failure. Then rerun connectivity before privilege/readiness evidence can be recorded. No runtime privilege suite, successful HTTP readiness result, transaction fixture or migration was executed in this attempt.

## Successful replacement-wallet follow-up

The new instance wallet was extracted into a separate user-owned directory outside the repository, with path/member bounds checked and the low-service endpoint compared to the prior wallet. The previous wallet was preserved. Only application wallet paths were changed; the user entered the new download password privately. Offline TLS-context initialization then passed. No password value, PEM contents or connection descriptor was printed.

An initial pooled acquisition failed with NJS-040 under the 1500 ms queue setting, while a direct API connection and isolated pooled UTC/bind/precision probes succeeded. Both local application files now explicitly use **ORACLE_QUEUE_TIMEOUT_MS=5000**, within existing validation bounds; global defaults, per-call 1500 ms budgets, certificate checks and zero driver retries are unchanged. The verification process received that local queue/call configuration explicitly. This addresses the observed acquisition budget, not a proven overall request deadline or future capacity guarantee. See [driver queueTimeout semantics](https://node-oracledb.readthedocs.io/en/latest/api_manual/oracledb.html#oracledb.queueTimeout).

| Executed check                                 | Actual result                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API/worker dependency-ordered production build | Passed before live execution                                                                                                                                                                                                                                                                                                                                      |
| Existing connectivity tool                     | Passed both actual identities/target, three repeated bound probes, six-digit timestamp projection, exact large NUMBER strings, reused-session UTC reset, release/reacquisition after SQL error and closed-local-pool unavailability                                                                                                                               |
| Real-pool compiled API factory over HTTP       | Readiness 200, then safe 503 after deliberate local pool closure and cache expiry; liveness stayed 200; matching header/body/log request IDs, no-store and application close passed                                                                                                                                                                               |
| Runtime privilege metadata                     | First uninstrumented invocation failed without a specific code. A copy with numbered boolean output and unchanged assertions passed all 14 checks for both accounts: CREATE SESSION only, no roles/admin option/direct object or column grants, owned tables or nonzero quota. No grants changed; this is metadata evidence, not destructive negative DDL testing |
| Compiled worker lifecycle                      | Real identity/target and UTC probe passed; idle startup, repeated shutdown coalescing, exactly one pool close and restoration of signal-listener counts passed through lifecycle callbacks. OS signal delivery was not tested                                                                                                                                     |

Secrets were supplied from local configuration into child-process environment by an ignored operator harness; the tracked tools themselves still load process environment only. The connectivity, privilege-diagnostic and lifecycle processes exited 0 and closed their pools. Earlier failed attempts remain documented rather than counted as passes. API/worker password fields currently match; separate-password rotation remains recommended and was not performed automatically. No business DDL/DML, migration, job or remote outage was executed.

## Step 06 acceptance re-audit, 22 November 2026

Latest request: audit Step 06 only before Step 07. Full `pnpm check` and coverage gates passed, with 177 unit/HTTP tests and all production builds. Both existing live connectivity and **original uninstrumented** privilege scripts then exited 0; the earlier diagnostic-only privilege pass is no longer the sole evidence. Both identities/target, UTC, exact-value probes, error/release behavior, real-pool readiness 200 -> 503 after local pool closure, liveness 200, safe request IDs/no-store and cleanup passed.

Actual built main executables were additionally exercised through Windows terminals: worker idle start and Ctrl+C log confirmed SIGINT/pool closure/shutdown complete; API main on an isolated port returned health 200, real readiness 200 and normalized 404, then exited on Ctrl+C and released the listener. Both terminal wrappers returned interrupt status 1, not exit 0; POSIX delivery and load-balancer draining were not tested. Server release reported 23.26.4.1.0. An operator-only read-only audit confirmed AL32UTF8, rejection of raw TIMESTAMP fetch/JS Date binds and subsequent pool reuse. The catalog query initially hit NJS-123 at the application's unchanged 1500 ms call budget; a bounded 5000 ms operator-only metadata budget succeeded. This does not establish a latency SLA.

Runtime-visible PUBLIC grant classification found 43 grants on schemas not flagged Oracle-maintained (including missing-owner metadata), including default INHERIT PRIVILEGES for the three SPORTIFY identities and OML/RMAN/service-named schema groups. This classification does not approve a complete database security baseline. Oracle documents [default inheritance grants and their meaning](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbseg/controlling-invokers-rights-privileges-procedure-calls-and-view-access.html); [ALL_TAB_PRIVS](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/ALL_TAB_PRIVS.html) and [ALL_USERS](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/ALL_USERS.html) define the inspected scope. Direct grants and SESSION_PRIVS remained restricted, and no grant was changed. ADMIN baseline/hardening review remains pending.

**Disposition:** scoped Step 06 acceptance checks passed; awaiting user verification, with no connectivity implementation blocker for a separately authorized Step 07. Transaction persistence without a designated disposable fixture remains explicitly pending as allowed by the prompt; remote outage/recovery, deployment/ARM64/POSIX, PUBLIC baseline review and independent credential rotation are not claimed complete. No Step 07 schema/migration was executed. See the [current acceptance record](../planning/progress.md).

## Explicit live suite

After operator [provisioning and postconditions](../../database/provisioning/README.md), confirm the selected instance requires mTLS and the configured host/service belong to the expressly authorized development/pilot target. The instance-wallet directory/password and both runtime passwords must be injected securely, not pasted into chat or typed in command arguments/history. Tools use process environment only and do not discover/load local secret files.

| Variable for verification only | Meaning                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| ORACLE_VERIFY_CONFIRM          | Exact `designated-development`; explicit operator intent                              |
| ORACLE_VERIFY_DB_UNIQUE_NAME   | Operator-confirmed database unique name, checked after connection before test queries |
| ORACLE_CONNECT_STRING          | Target's option-free TCPS host/port/service; never printed                            |
| ORACLE_WALLET_DIRECTORY        | Absolute protected directory containing the designated instance ewallet.pem           |
| ORACLE_WALLET_PASSWORD         | Separately supplied instance-wallet decryption secret                                 |
| ORACLE_API_PASSWORD            | API secret supplied securely                                                          |
| ORACLE_WORKER_PASSWORD         | Separate worker secret supplied securely                                              |
| ORACLE_QUEUE_TIMEOUT_MS        | Optional bounded pool queue override; this local verification used `5000` ms          |

Run from the root, after secure injection:

```sh
pnpm oracle:connectivity
pnpm oracle:privileges
# Or both, including production compilation:
pnpm test:oracle
```

Use `npx --yes pnpm@10.34.9` in place of pnpm if necessary. Missing designation/configuration fails with a nonzero prerequisite result before either identity connects; no skip is reported as pass. No target is chosen automatically, and the tools perform no provisioning or DDL. They sanitize errors and print only role/check summaries, never returned identities/descriptors/raw exceptions.

Connectivity requires both real identities, SESSION_USER and target match, three repeated UTC/bind probes, exact large NUMBER and six-digit UTC string projection round trips, resetting a deliberately changed pooled timezone on the next checkout, failure/reacquisition with pool maximum one, and unavailable state after controlled local pool shutdown. The connectivity command also builds the production API, runs its real runtime pool on ephemeral loopback HTTP, verifies readiness 200, closes only that local pool, waits beyond the cache and verifies readiness 503 while liveness remains 200, including request-ID/log correlation and no-store. No remote outage is induced. This path was executed against the operator-designated development target as recorded above. Privilege verification requires CREATE SESSION only, no roles/admin option/direct object or column grants, owned tables or quota. Administrator postconditions additionally inspect column grants and PUBLIC grants. These are deliberately **pre-business-schema** expectations; reviewed later grants must revise the manifest deliberately.

For a real HTTP readiness check, start the built API with its separately injected runtime environment and request `/api/v1/health` and `/api/v1/ready`. Observe 200 versus safe 503, matching X-Request-ID/body/log IDs and no-store. To test an actual remote failure/recovery, an operator may use an already-authorized isolated disposable target outage and wait beyond the 1s probe cache; never stop a shared service, alter network access or revoke grants merely to run this suite. Record this check pending if no safe failure mechanism exists. Local closed-pool HTTP checks do not prove remote recovery.

## Remaining evidence

- Actual SQLcl/ATP version, database capability/quota and password-authentication transition; admin catalog postconditions including inherited PUBLIC rights.
- TLS certificate/server identity, actual API/worker credentials, sessions, binds and pool pressure behavior on the selected target.
- Real HTTP readiness outage/recovery and built process shutdown with the real driver; latency against actual DNS/network failures.
- Transaction persistence/rollback on an explicitly designated test schema and owner-created disposable fixture. None is created here; no temporary runtime DDL rights or business-record mutations are allowed. An operator must approve fixture setup/grants/cleanup and record cleanup evidence before those tests can be added/run.
- OCI/Linux ARM64 execution, POSIX signal handling and load-balancer draining.

Run ordinary local checks separately: `pnpm check`, `pnpm test:coverage`, `pnpm install --frozen-lockfile`. Unit driver mocks verify lifecycles; HTTP fixtures use the production configureApp path with explicitly injected dependency state. Live commands are not part of `pnpm test`, `pnpm check` or pull-request CI. Live failures remain a separate incomplete gate.

## Step 07 Oracle gate passed, 23 November 2026

D-18-approved original migrations 000001-000011 applied cleanly to the designated application owner, repeated as a no-op and passed separate exact catalog verification. Actual state: 26 tables, 259 columns, 206 named constraints, 30 explicit indexes, eight sports, 20 permission codes, no invalid objects/demo tenants/users/admins or role-permission assignments. History has exactly 11 APPLIED, no repairs and no pending versions.

The user performed the narrow ADMIN owner-lock grant and separate test-owner preparation. Independent real test-owner login verified identity/target, exact CREATE SESSION/TABLE/SEQUENCE without admin option, no roles/column grants, only DBMS_LOCK EXECUTE, finite 256 MB quota, empty schema and locking. Secrets remained private.

The first disposable run failed at 000008 due to a verifier assumption about extended VARCHAR2 internal LOB storage. Exact metadata proved its DDL complete; the corrected verifier/regression tests and strict explicit same-lock reconciliation retained FAILED 000008 linked to test-only APPLIED 000012. The resumed full suite exited 0: metadata/repeat/checksum/seed customization checks, all 33 exact constraint cases, concurrent lock exclusion across committed DDL, actual controlled ORA-00904/later-step refusal and forward repair, both runtime positive/negative privilege probes and cleanup. A final test catalog/history audit passed 15 rows, with repaired failures 000008->000012 and 000013->000015 retained. No history/owner was erased. The application manifest contains no test entries and independently proved clean all-phase apply.

Both runtimes additionally received exact Oracle access denials for actual application-history SELECT/non-mutating UPDATE after positive identity/DUAL access. Existing real connectivity and built API regression passed health/readiness 200, readiness safe 503 after controlled local pool close, liveness 200, no-store/request IDs and cleanup. No runtime object grants changed; no external outage was induced.

See [complete dated evidence, commands and limits](step07-verification.md). Ordinary check/coverage passed 188 tests and all builds. Default live-suite invocation still requires a genuinely empty separately prepared test owner; the retained used schema is not automatically reused/cleared. [One-shot reconciliation safety](../../database/tests/README.md#explicit-first-run-extended-string-reconciliation) applies only to its exact original state, already reconciled here.

**Step 07 Oracle verification gate passed; awaiting user verification.** No authentication, booking, schema-version readiness, commercial-readiness or Step 08 implementation is implied. Earlier Step 06 deployment/remote-outage/PUBLIC-baseline limitations remain separate.

## Step 08 draft and live gate

Step 08 baseline history and the exact original Step 07 catalog were independently rechecked successfully. A read-only DUAL probe passed decimal-string/six-digit timestamp expressions only. The new Step 08 table/integrity/A-E concurrency suite has not run, and the new SPORTIFY_STEP08_TEST_OWNER was absent in metadata. Design questions remain unanswered; manifest review/three STEP08 blockers refuse mutation. [Current complete gate/operator record](step08-verification.md) is not superseded by the earlier Step 07 passes.

The separate owner preserves retained Step 07 test repair history and avoids version collisions. No production/unidentified target, application-schema recreation, broad grants or runtime DDL is authorized. New real tests require exact identity/target/empty state/privileges, explicit disposable marker and private password. Step 08 remains awaiting user verification with Oracle gate incomplete; Step 09 is not started.

## D-21 Step 08 approval continuation

All three policies are approved and reconciled; manifest ready is not a live pass. Current read-only designated-target inspection confirms exactly original 11 APPLIED records, no Step 08 test owner and an empty private Step 08 test password. No Step 08 account/grant/migration/fixture has been executed. The new suite adds PENDING_PAYMENT acceptance, zero-total PAID/no-receipt and rejection of a zero-total unpaid header, duplicate effective receipt/refund rejection, and retained excluded finance history. Existing A-E transaction harnesses remain unexecuted. Full payment/refund amounts and maintenance coordination are future transaction responsibilities, not inferred from these cases. Stop for the user's exact separate test-owner preparation per [current operator sequence](step08-verification.md); preserve Step 07 repair history.

## Current D-22 Step 08 executed acceptance

This supersedes the historical blocked statements above. The full isolated suite exited 0 after explicit retained 000017->000018 verifier recovery: 40 integrity rejections/positive fixtures, all A-E races, exact catalog/repeat/checksum, known cleanup and both runtime denials. Application 000012-000017 then applied cleanly, repeated no-op, passed verify and returned 17 APPLIED/no pending. Independent three-owner audit confirms 36 tables/394 columns/320 constraints/67 explicit indexes, no invalid objects/business rows, preserved old test repairs and no new runtime grants. [Exact failures, recovery, commands and limits](step08-verification.md). Step 08 awaiting user verification; no further setup blocker or Step 09.
