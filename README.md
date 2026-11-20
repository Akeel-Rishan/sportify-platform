# SPORTIFY

A multi-tenant indoor sports booking and business management platform for Sri Lanka.

**Current stage: Step 06 local Oracle connectivity implementation, awaiting user verification.** The API has safe versioned contracts/logging and Oracle-required readiness; the worker owns a separate idle process/pool. Provisioning scripts and a secure runbook are available. The user selected required mTLS and reports creating an Always Free development instance. Exact target identity/status, wallet and runtime credentials are not yet verified; account provisioning and live Oracle behavior remain blocked. Business tables, authentication and bookings are not implemented. The responsive web foundation is unchanged.

API/worker now require separate Oracle runtime configuration. Without a target, run `pnpm dev:web`; local checks/builds use no real credentials. Follow [setup](Docs/development/local-setup.md) before `pnpm dev` or production API/worker starts.

## Prerequisites and installation

- Node.js **22.22.0**, pinned in `.nvmrc` (the tested local LTS runtime).
- pnpm **10.34.9**, pinned in `package.json`.

If pnpm is available at the pinned version:

```sh
pnpm install --frozen-lockfile
```

If pnpm is not installed, use `npx --yes pnpm@10.34.9` in place of `pnpm` in every command. This downloads the pinned command into npm's cache without changing global tools:

```sh
npx --yes pnpm@10.34.9 install --frozen-lockfile
npx --yes pnpm@10.34.9 dev:web
```

## Commands

| Command                                | Behavior                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm dev`                             | Build shared packages, then run labeled web/API/worker processes; Ctrl+C stops the process group |
| `pnpm dev:web`                         | Next.js development server at http://localhost:3000                                              |
| `pnpm dev:api`                         | Compile/watch NestJS and run on port 4000 by default                                             |
| `pnpm dev:worker`                      | Watch the separate idle worker; no HTTP port                                                     |
| `pnpm typecheck`                       | Build shared packages, generate Next.js route types and strictly check all projects              |
| `pnpm build`                           | Topologically build all workspace projects, including production entry points                    |
| `pnpm --filter @sportify/web start`    | Run built web application on port 3000                                                           |
| `pnpm --filter @sportify/api start`    | Run compiled API (`PORT` override supported)                                                     |
| `pnpm --filter @sportify/worker start` | Run compiled idle worker                                                                         |

The API serves `/api/v1/health` and `/api/v1/ready`. Unimplemented routes, including `/`, return a safe HTTP 404 envelope; no business endpoint exists yet. Run production starts after `pnpm build`. Stop with Ctrl+C. No global Next.js, Nest CLI or TypeScript compiler is needed.

## Workspace

- `apps/web`, `apps/api`, `apps/worker`: independent application processes.
- `packages/shared-types`: an empty framework-independent entry point for future agreed types. `packages/api-contracts` exports transport response/error and health contracts. `packages/validation` supplies the shared environment parser without reading process state or files.
- `packages/shared-config`: tooling-only TypeScript configuration; no runtime configuration or secrets.
- `packages/database`: server-only Oracle configuration, pool/session and transaction ownership.
- `database/provisioning/`, `infra/scripts/oracle-*.mjs`: operator-reviewed account preparation and explicitly invoked live verification tools; no business migrations/deployment.
- `Docs/`: preserved source documents and working specifications; keep this exact casing on Linux.

Quality commands: `pnpm lint`, `pnpm lint:fix`, `pnpm format:check`, `pnpm format`, `pnpm test`, `pnpm test:watch`, `pnpm test:coverage`, `pnpm test:http`, and `pnpm check`. `check` stops on failures in format, lint, typecheck, tests or build. CI runs tests with coverage; it does not deploy or require cloud/database secrets.

See [API conventions](Docs/api/conventions.md), [health/readiness](Docs/api/health-and-readiness.md), [local setup](Docs/development/local-setup.md), [environment configuration](Docs/development/environment-configuration.md), [testing](Docs/development/testing.md), [CI checks](Docs/quality/ci-checks.md), [toolchain evidence](Docs/architecture/toolchain.md), [progress](Docs/planning/progress.md) and the [documentation index](Docs/README.md).
