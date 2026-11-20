# SPORTIFY

A multi-tenant indoor sports booking and business management platform for Sri Lanka.

**Current stage: Step 03 quality and configuration foundation.** The web application displays a static foundation page. The API starts without business routes. The separate worker is explicitly idle. Validated startup configuration, lint/format/unit checks and pull-request CI are configured. Oracle, authentication, tenant routing and booking workflows are not connected.

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
npx --yes pnpm@10.34.9 dev
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

The API returns HTTP 404 for unimplemented routes, including `/`; no health or business endpoint exists yet. Run production starts after `pnpm build`. Stop with Ctrl+C. No global Next.js, Nest CLI or TypeScript compiler is needed.

## Workspace

- `apps/web`, `apps/api`, `apps/worker`: independent application processes.
- `packages/shared-types`, `api-contracts`: empty framework-independent entry points for future agreed contracts. `packages/validation` supplies the shared environment parser without reading process state or files.
- `packages/shared-config`: tooling-only TypeScript configuration; no runtime configuration or secrets.
- `database/`, `infra/`: documented future work directories; no database/deployment implementation.
- `Docs/`: preserved source documents and working specifications; keep this exact casing on Linux.

Quality commands: `pnpm lint`, `pnpm lint:fix`, `pnpm format:check`, `pnpm format`, `pnpm test`, `pnpm test:watch`, `pnpm test:coverage`, and `pnpm check`. `check` stops on failures in format, lint, typecheck, tests or build. CI runs tests with coverage; it does not deploy or require cloud/database secrets.

See [local setup](Docs/development/local-setup.md), [environment configuration](Docs/development/environment-configuration.md), [testing](Docs/development/testing.md), [CI checks](Docs/quality/ci-checks.md), [toolchain evidence](Docs/architecture/toolchain.md), [progress](Docs/planning/progress.md) and the [documentation index](Docs/README.md).
