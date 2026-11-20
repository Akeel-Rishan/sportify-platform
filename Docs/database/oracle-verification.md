# Oracle verification gates

**Live status: BLOCKED.** The user selected mTLS and reports creating the Mumbai Always Free development instance. The exact target identity/status, protected wallet and runtime credentials are not yet available for verification. No provisioning/password change/database connection/business DDL/DML/migration/network change was executed by the agent. Mocks and compiled local harnesses do not prove Oracle behavior.

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

Run from the root, after secure injection:

```sh
pnpm oracle:connectivity
pnpm oracle:privileges
# Or both, including production compilation:
pnpm test:oracle
```

Use `npx --yes pnpm@10.34.9` in place of pnpm if necessary. Missing designation/configuration fails with a nonzero prerequisite result before either identity connects; no skip is reported as pass. No target is chosen automatically, and the tools perform no provisioning or DDL. They sanitize errors and print only role/check summaries, never returned identities/descriptors/raw exceptions.

Connectivity requires both real identities, SESSION_USER and target match, three repeated UTC/bind probes, exact large NUMBER and six-digit UTC string projection round trips, resetting a deliberately changed pooled timezone on the next checkout, failure/reacquisition with pool maximum one, and unavailable state after controlled local pool shutdown. The connectivity command also builds the production API, runs its real runtime pool on ephemeral loopback HTTP, verifies readiness 200, closes only that local pool, waits beyond the cache and verifies readiness 503 while liveness remains 200, including request-ID/log correlation and no-store. No remote outage is induced. This live path has not been executed without an authorized target. Privilege verification requires CREATE SESSION only, no roles/admin option/direct object or column grants, owned tables or quota. Administrator postconditions additionally inspect column grants and PUBLIC grants. These are deliberately **pre-business-schema** expectations; reviewed later grants must revise the manifest deliberately.

For a real HTTP readiness check, start the built API with its separately injected runtime environment and request `/api/v1/health` and `/api/v1/ready`. Observe 200 versus safe 503, matching X-Request-ID/body/log IDs and no-store. To test an actual remote failure/recovery, an operator may use an already-authorized isolated disposable target outage and wait beyond the 1s probe cache; never stop a shared service, alter network access or revoke grants merely to run this suite. Record this check pending if no safe failure mechanism exists. Local closed-pool HTTP checks do not prove remote recovery.

## Remaining evidence

- Actual SQLcl/ATP version, database capability/quota and password-authentication transition; admin catalog postconditions including inherited PUBLIC rights.
- TLS certificate/server identity, actual API/worker credentials, sessions, binds and pool pressure behavior on the selected target.
- Real HTTP readiness outage/recovery and built process shutdown with the real driver; latency against actual DNS/network failures.
- Transaction persistence/rollback on an explicitly designated test schema and owner-created disposable fixture. None is created here; no temporary runtime DDL rights or business-record mutations are allowed. An operator must approve fixture setup/grants/cleanup and record cleanup evidence before those tests can be added/run.
- OCI/Linux ARM64 execution, POSIX signal handling and load-balancer draining.

Run ordinary local checks separately: `pnpm check`, `pnpm test:coverage`, `pnpm install --frozen-lockfile`. Unit driver mocks verify lifecycles; HTTP fixtures use the production configureApp path with explicitly injected dependency state. Live commands are not part of `pnpm test`, `pnpm check` or pull-request CI. Live failures remain a separate incomplete gate.
