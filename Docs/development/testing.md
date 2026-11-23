# Testing and verification

Use Node 22.22.0 and pinned pnpm 10.34.9. If pnpm is absent, replace `pnpm` below with `npx --yes pnpm@10.34.9`. No global compiler or runner is needed.

| Command                             | Purpose                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm lint` / `pnpm lint:fix`       | ESLint CLI with zero warnings; the latter explicitly applies fixes                         |
| `pnpm format:check` / `pnpm format` | Read-only Prettier validation / explicit formatting                                        |
| `pnpm typecheck`                    | Build shared dependencies, generate web route types, strictly check all workspaces         |
| `pnpm test`                         | Build shared packages, then deterministic non-watch Vitest run                             |
| `pnpm test:watch`                   | Build shared packages and watch focused tests during development                           |
| `pnpm test:coverage`                | Non-watch tests plus V8 coverage and thresholds                                            |
| `pnpm build`                        | Production builds in dependency order                                                      |
| `pnpm check`                        | Format check → lint → typecheck → non-watch tests → production build; stops on any failure |

## Current suites

One Vitest Node-environment runner discovers `apps/{api,worker}/src/**/*.test.ts`, `packages/validation/src/**/*.test.ts`, and `apps/api/test/**/*.e2e-spec.ts`. No browser emulator, static-text component test or global pass-with-no-tests option is configured. Behavior-free shared-types/shared-config packages and transport type declarations and the static web page have no behavior requiring a unit suite yet.

Tests cover absent defaults, accepted modes/port boundaries, malformed and empty input, safe errors, unknown input stripping, development-file precedence, production/test file isolation and read errors. Temporary test fixtures contain synthetic configuration, are isolated under OS temp directories and are removed in teardown. Tests do not need real `.env` files or external services.

Startup tests reject invalid config before Nest resource creation or worker lifecycle allocation. A real local Nest application uses an ephemeral listener, returns 404 and closes in teardown. Worker tests use fake timers and invoke the installed handler without signaling unrelated test-runner listeners; both shutdown paths clear timers/listeners and tolerate repeated shutdown. These are Node unit/local startup checks, not Oracle integration or proof of POSIX signal delivery.

Production TypeScript settings remain Node16/CommonJS for API/worker, while web keeps Next's bundler settings. For API source/tests, a scoped Vite plugin uses the existing TypeScript compiler with legacy decorators and emitted runtime metadata before Vitest transforms the module. This matches production decorator settings without changing its module mode or adding a runner. A real HTTP test verifies DTO parameter metadata by rejecting invalid input and preserving valid boolean false. Use concrete runtime DTO imports, not type-only imports, for decorated parameters. Production continues to use `tsc`.

## HTTP integration suites

`pnpm test:http` builds shared packages and runs `apps/api/test/**/*.e2e-spec.ts` through the existing Vitest runner. Root `test`, `test:coverage`, `check` and CI include them automatically. To run one file: `pnpm build:packages`, then `pnpm exec vitest run apps/api/test/health.e2e-spec.ts`.

`test/support/http-fixture.ts` registers test-only controllers/DTOs in a test module. It calls the same `configureApp()` as production before initialization, preserving early request-context/parser ordering, global prefix, filters, interceptor and pipe. Applications listen on ephemeral loopback ports and close in teardown or on fixture creation failure. The production TypeScript build excludes the entire test directory and source unit tests; AppModule imports only HealthModule.

Coverage exercises real HTTP success/error envelopes, status/body semantics, nested/unknown DTO fields and strict booleans, parser 400/413 failures, correlation isolation, secret redaction, route-template logs, single completion on client disconnect, already-sent response handling and readiness 200/503/no-store. Captured structured sinks avoid console assertions. Readiness uses injected application state, not a mocked Oracle result. Bound validation details and log-sink isolation also have focused unit checks. No dependency connection is attempted.

Client-disconnect tests close the native HTTP response and await an event-driven completion record with a bounded diagnostic timeout; completion clears its listener/timer. No fake production routes, busy polling or lingering servers are required. These are local HTTP integration tests, not browser end-to-end or Oracle integration tests.

## Coverage and diagnostics

Coverage includes executable API/worker source introduced in this step and the shared environment helper. Environment files and the shared parser require 95% statements/lines/functions and 90% branches. This high scoped gate protects configuration failure paths without inventing an artificial percentage across empty packages or a static UI. Main entry-point and lifecycle coverage is reported too; it is not excluded merely to improve percentages.

Reports: `coverage/index.html`, `coverage/lcov.info`, `coverage/coverage-summary.json`, and `test-results/unit.xml`. Outputs are ignored. CI uploads them when available, including after a failure. No claimed security scan is part of this step.

## Lint and formatting boundaries

The root flat ESLint configuration scopes the official Next core-web-vitals/React/hooks/accessibility rules to web, type-aware recommended TypeScript rules to application/shared TS projects, and untyped config checks to root tooling. Promise misuse, accidental `any`, unused imports/variables, app-internal shared imports and direct process environment access outside loaders are checked. Prefix an intentionally unused argument with `_`; do not use broad disables. Prettier disables conflicting formatting rules in ESLint.

Prettier covers authored code/config/CSS/YAML and maintained setup/planning documentation. Generated content, lockfiles, uploaded source packages/PDFs, generated agent instructions and untouched Step 01 reference documents are excluded. Existing reference documents are not rewritten to make checks green.

For failures, run the failing command or a focused `pnpm exec vitest run path/to/file.test.ts` after `pnpm build:packages`. Fix the cause rather than disabling a check. Root watch builds shared packages once; rebuild validation/api-contracts if their consumed implementations change.

## Future suites

Oracle integration belongs to an explicit later step, runs against actual isolated Oracle, and proves constraints/transactions/concurrency with separate connections. No mock or SQLite result substitutes for it. Browser end-to-end and accessibility suites will exercise real connected workflows separately; their tooling is not installed here. No business feature, deployment, database migration or cloud service is required by the current suite.

## Step 06 Oracle boundary tests

`pnpm test` and `pnpm test:coverage` include `packages/database/src/**/*.test.ts`, API readiness unit/real-HTTP tests and worker lifecycle tests. Driver mocks are explicitly unit tests: no real Oracle query/transaction/TLS evidence is implied. Environment loader tests inject isolated placeholder credentials, retain process/file precedence and skip local files in test/production. HTTP fixtures use production configureApp and inject readiness state; production application tests inject a fake database factory and close all applications/pools. Fake timers/listeners are restored. No production test controller, endpoint or database-health toggle was added.

The real suite is explicitly invoked as `pnpm test:oracle` (or separate `pnpm oracle:connectivity` / `pnpm oracle:privileges`), excluded from normal tests/checks/PR CI. It fails prerequisites with exit 1 instead of skipping when target designation or secrets are absent. See [live requirements, safe checks and pending fixture/outage gates](../database/oracle-verification.md). No runtime DDL rights or business mutations are allowed for tests. Transaction persistence remains pending until an approved owner-created disposable fixture and cleanup protocol exist.

The mTLS follow-up adds wallet configuration failures (missing/empty/relative/NUL paths or missing password), real temporary-file metadata/readability preflight tests (missing, empty, directory versus regular file) and exact forwarding of walletLocation/walletPassword to the mocked driver. Dummy wallet files contain authored non-certificate text and are removed after tests. These checks do not parse actual wallet material or prove decryption/TLS/Oracle behavior. A normal build/PR test run never requires a real wallet or credentials.

## Step 07 migration tests

`pnpm test` / `pnpm test:coverage` include packages/migrations/src/*.test.ts: artifact format/confinement/order/checksums, planning/repair admission, owner/target/config privacy, same-session advisory-lock protocol, registry bootstrap/refusal, failure stopping, lifecycle cleanup and exact catalog metadata comparisons. Driver/metadata fixtures are explicitly unit evidence; they do not prove DDL commits, FK enforcement, real locking or grants on Oracle. Existing API/worker tests remain in the normal run.

`pnpm test:oracle:runner` is retained as an alias for the full explicit disposable Step 07 suite described below. It is excluded from normal tests/CI, fails incomplete prerequisites instead of skipping, and requires approved artifacts plus a distinct empty SPORTIFY_TEST_OWNER. The implementation now includes controlled failure/repair, tenant integrity and positive/negative runtime privilege checks. Those checks have now passed on the designated Oracle target; see the dated execution/recovery evidence. The suite retains disposable installed schema/history and cleans only its own nonce lock-probe table; see [test safety](../../database/tests/README.md).

## Step 06 acceptance audit evidence

On 22 November 2026, `pnpm check` and `pnpm test:coverage` passed all 177 tests and existing gates. The existing compiled connectivity and original privilege tools passed using secure child-process environment injection against the operator-designated real database; these were separate from ordinary tests, and the aggregate root `test:oracle` command was not claimed executed. Actual API/worker built main entry points also started and stopped through Windows terminal Ctrl+C; wrapper interruption status was 1, with worker cleanup confirmed and API listener released. Read-only operator probes confirmed temporal rejection/reuse, charset and server release. No test fixture, business table, DDL privilege or migration was introduced. See [current acceptance record](../planning/progress.md) and [live limits](../database/oracle-verification.md).

## Resumed Step 07 tests

Fast pure/driver-mock tests now also include `database/tests/unit/**/*.test.mjs`; `pnpm test` builds the public operator package before imports. Recovery-plan checks preserve release checksums and refuse unresolved failure/tampered repair, and runtime configuration tests forbid falling back to owner credentials. These are unit tests, not Oracle evidence.

`pnpm test:oracle:step07` is the explicit full disposable suite (the previous runner alias is retained). It is excluded from ordinary tests/CI and requires an approved ready manifest, verified dedicated empty test owner, real runtime credentials and explicit disposable confirmation. The suite uses the same public migration functions as operator commands, tests exact Oracle error/constraint outcomes, rolls back integrity/customization DML, closes resources and retains deliberate failure/repair history in the disposable schema. It does not clear or reuse an application schema. [Safety/prerequisites](../../database/tests/README.md) and [owner configuration](../database/migration-guide.md) apply; the live suite and independent application clean/repeat/catalog checks now passed, documented in [dated evidence](../database/step07-verification.md).

Static commands: `python database/design/verify-design.py` (broader design/links) and `python database/verification/verify-step07-design.py` (restricted scoped SQL/metadata agreement). Neither compiles/executes Oracle SQL. Run full formatting/lint/typecheck/tests/build and meaningful coverage after code changes.

## Actual Oracle extended-string regression

Catalog unit tests now cover allowed internal LOB storage only for exact validated extended VARCHAR2 columns, and refuse unrelated/ordinary-column LOB claims. The explicit disposable reconciliation additionally has pure checksum/preservation and wrong-owner/history refusal tests. These unit checks do not replace its actual Oracle execution; see [live evidence](../database/oracle-verification.md) and [one-shot recovery safety](../../database/tests/README.md#explicit-first-run-extended-string-reconciliation).

## Step 08 explicit Oracle tests (executed under D-22)

`pnpm test:oracle:step08` builds the public migration package and runs database/tests/oracle-step08.mjs, excluded from ordinary tests/CI. It requires an accepted ready manifest, exact new disposable identity, known target, separate private configuration and initially empty owner. Old Step 07 test repairs are preserved in their separate owner. [Detailed prerequisites and barrier/cleanup semantics](../database/step08-verification.md) apply.

Unit tests validate half-open UTC fixture grids, explicit exact number/timestamp binding, identifier allowlists, owner restrictions and rejection classification. They do not prove Oracle constraints/concurrency. The actual suite checks full clean/repeat/catalog/checksum behavior, named-constraint integrity, A-E separate-session barriers and complete loser rollback/conversion, narrow runtime denials and known-fixture cleanup. No arbitrary sleeps, connection-failure-as-denial, schema wipe or production endpoint. A failed/used target is not automatically cleared or silently adopted. New fixture functions are test-only and are never application booking/payment services.

D-21 clears Step 08 policy review only. The isolated suite now also checks PENDING_PAYMENT, zero-total PAID/no receipt and CK_BOOKINGS_ZERO_PAYMENT rejection, conditional posted-payment/processed-refund uniqueness, and excluded correction/request history. Its normal invocation requires an empty SPORTIFY_STEP08_TEST_OWNER; the current used target supports only the guarded recovered-state flag documented below. Local unit/static checks do not execute these Oracle assertions; do not run the suite with the Step 07 test credential file.

D-22 executed the full Step 08 Oracle suite successfully after its initial CASE-comparator failure. Only the exact observed isolated state supports `node --env-file="<protected-step08-file>" database/tests/oracle-step08.mjs --reconcile-case-catalog`: first verify matching checksums/full catalog/zero business rows, retain FAILED 000017 and APPLIED repair 000018, then run all integrity/A-E/cleanup/denial cases. Unknown histories refuse recovery. Normal no-argument invocation still requires a genuinely empty owner. Do not drop/recreate or clear the used schema. Current acceptance: 40 Oracle rejection cases/A-E, 201 local tests and builds; [full recovery and limits](../database/step08-verification.md).
