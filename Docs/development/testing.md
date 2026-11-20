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

One Vitest Node-environment runner discovers `apps/{api,worker}/src/**/*.test.ts` and `packages/validation/src/**/*.test.ts`. No browser emulator, static-text component test or global pass-with-no-tests option is configured. Empty shared-types/api-contracts/shared-config packages and the static web page have no behavior requiring a unit suite yet.

Tests cover absent defaults, accepted modes/port boundaries, malformed and empty input, safe errors, unknown input stripping, development-file precedence, production/test file isolation and read errors. Temporary test fixtures contain synthetic configuration, are isolated under OS temp directories and are removed in teardown. Tests do not need real `.env` files or external services.

Startup tests reject invalid config before Nest resource creation or worker lifecycle allocation. A real local Nest application uses an ephemeral listener, returns 404 and closes in teardown. Worker tests use fake timers and invoke the installed handler without signaling unrelated test-runner listeners; both shutdown paths clear timers/listeners and tolerate repeated shutdown. These are Node unit/local startup checks, not Oracle integration or proof of POSIX signal delivery.

Production TypeScript settings remain Node16/CommonJS for API/worker, while web keeps Next's bundler settings. Vitest transforms test TypeScript without changing those settings. The current empty Nest module has no constructor injection requiring emitted decorator metadata in tests; before testing future injectable services, validate a metadata-preserving transform or test compiled Nest code. Production already uses `tsc` with decorator metadata.

## Coverage and diagnostics

Coverage includes executable API/worker source introduced in this step and the shared environment helper. Environment files and the shared parser require 95% statements/lines/functions and 90% branches. This high scoped gate protects configuration failure paths without inventing an artificial percentage across empty packages or a static UI. Main entry-point and lifecycle coverage is reported too; it is not excluded merely to improve percentages.

Reports: `coverage/index.html`, `coverage/lcov.info`, `coverage/coverage-summary.json`, and `test-results/unit.xml`. Outputs are ignored. CI uploads them when available, including after a failure. No claimed security scan is part of this step.

## Lint and formatting boundaries

The root flat ESLint configuration scopes the official Next core-web-vitals/React/hooks/accessibility rules to web, type-aware recommended TypeScript rules to application/shared TS projects, and untyped config checks to root tooling. Promise misuse, accidental `any`, unused imports/variables, app-internal shared imports and direct process environment access outside loaders are checked. Prefix an intentionally unused argument with `_`; do not use broad disables. Prettier disables conflicting formatting rules in ESLint.

Prettier covers authored code/config/CSS/YAML and maintained setup/planning documentation. Generated content, lockfiles, uploaded source packages/PDFs, generated agent instructions and untouched Step 01 reference documents are excluded. Existing reference documents are not rewritten to make checks green.

For failures, run the failing command or a focused `pnpm exec vitest run path/to/file.test.ts` after `pnpm build:packages`. Fix the cause rather than disabling a check. Root watch builds shared packages once; rebuild the validation package if its consumed implementation changes.

## Future suites

Oracle integration belongs to an explicit later step, runs against actual isolated Oracle, and proves constraints/transactions/concurrency with separate connections. No mock or SQLite result substitutes for it. Browser end-to-end and accessibility suites will exercise real connected workflows separately; their tooling is not installed here. No business feature, deployment, database migration or cloud service is required by the current suite.
