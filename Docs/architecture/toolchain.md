# Toolchain and package boundaries

Selected 16 November 2026 for Step 02; exact engine/peer and Linux ARM64 compiler metadata rechecked directly against the official npm registry on 20 November. Versions are exact direct-dependency pins; `pnpm-lock.yaml` records the resolved graph. Compatibility below combines official documentation, exact registry metadata and the local checks recorded in [progress](../planning/progress.md). No prerelease dependency is selected.

## Version selection

| Tool/package | Exact version | Reason and evidence |
|---|---|---|
| Node.js | 22.22.0 | Installed local LTS runtime; .nvmrc and root engines pin it. [Official release](https://nodejs.org/en/blog/release/v22.22.0) identifies LTS and publishes Linux ARM64 binaries. This is a development reproducibility pin, not a claim it is the newest security patch or a production runtime approval |
| pnpm | 10.34.9 | Stable JavaScript pnpm 10 line; [registry engines](https://registry.npmjs.org/pnpm/10.34.9) requires Node >=18.12. Selected over current native pnpm 12 to retain the established Node-based cross-platform workspace workflow. packageManager pin and exact npx fallback avoid global changes |
| Next.js | 16.4.6 | Stable release; [registry metadata](https://registry.npmjs.org/next/16.4.6) requires Node >=20.9.0 and accepts React ^19.0.0. App Router with supported TypeScript/bundler settings |
| React / React DOM | 19.3.1 each | Stable matched pair; [React DOM metadata](https://registry.npmjs.org/react-dom/19.3.1) requires React ^19.3.1; satisfies Next peers |
| NestJS common/core/platform-express | 11.2.10 each | Matched stable v11 line; [core metadata](https://registry.npmjs.org/@nestjs/core/11.2.10) requires Node >=20 and v11 peers. Uses established TypeScript decorator metadata/CommonJS compilation instead of moving to the newer ESM-only v12 line |
| TypeScript | 5.9.3 | Stable compiler, selected over major-version migration; supports Next bundler resolution and Node16 module mode with Nest decorator metadata. [Registry metadata](https://registry.npmjs.org/typescript/5.9.3) |
| @types/node | 22.20.5 | Node 22 declaration line matching runtime major |
| @types/react / @types/react-dom | 19.3.0 each | Matching React 19 declaration line and declared peer relationship |
| reflect-metadata / rxjs | 0.2.2 / 7.8.2 | Satisfy Nest v11 peer ranges |
| concurrently | 10.0.7 | Cross-platform labeled process runner; Node >=22 fits selected runtime. Stops sibling processes on exit; no custom Unix-only shell process control |
| tsx | 4.23.15 | Worker development watcher only; Node >=18. Production worker uses compiled JavaScript |

Tailwind is unnecessary for the small foundation page, so it is not installed. Native CSS and system font fallbacks meet the current scope. No UI library, ORM, database driver, Turborepo/Nx, Redis/Kafka or test/lint/CI framework is introduced.

Additional official references consulted: [Next installation and TypeScript requirements](https://nextjs.org/docs/app/getting-started/installation), [Nest v11 first steps](https://docs.nestjs.com/v11/first-steps), [Nest version compatibility](https://docs.nestjs.com/faq/versions), [pnpm workspace protocol](https://pnpm.io/workspaces), [TypeScript module reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html). The versioned Nest page was returned in search results; direct page fetch timed out, so exact registry engines/peers and actual local compilation/startup provide the version-specific evidence.

## ARM64 support path and limits

Node publishes a Linux ARM64 binary for this runtime. Next publishes [@next/swc-linux-arm64-gnu 16.4.6](https://registry.npmjs.org/@next/swc-linux-arm64-gnu/16.4.6), whose metadata declares `os: linux` and `cpu: arm64`; Next selects native packages for the installation target. pnpm 10, TypeScript, React, Nest and the process tooling run under Node, with no application-specific native bindings introduced here. Optional image/compiler/watch dependencies must still install and execute correctly on the future target.

**Actual execution is Windows x64 only.** No Linux ARM64 installation, container build or OCI deployment was executed. Docker compatibility, libc/base image selection, pool/database drivers and cloud capability checks remain later work. This support path is evidence to test, not an ARM64 test result.

## TypeScript, modules and build order

- `tsconfig.base.json` owns strict checks and ES2022 target. `@sportify/shared-config/typescript.json` is the tooling-only export used by each project through a `workspace:*` development dependency. The config extends the root baseline; it is private and repository-local.
- Web uses Next's plugin, `module: esnext`, `moduleResolution: bundler`, DOM libs, isolated modules and noEmit. `next typegen` creates route types before typechecking a fresh checkout. No Next compilation output is used by API/worker.
- API compiles with `tsc`, Node16 resolution/CommonJS package mode, experimentalDecorators and emitDecoratorMetadata. Development combines compiler watch and Node watch after an initial build. This preserves decorator metadata when future dependency injection is introduced; production uses `node dist/main.js`.
- Worker uses Node16 resolution/CommonJS and Node types. `tsx watch` is development-only; production uses `node dist/main.js`. Its timer is explicitly idle, with no job work, listeners or connections.
- `shared-types`, `api-contracts` and `validation` build empty, browser-safe `dist/index.js` and `dist/index.d.ts` entries with explicit `types`, `require` and default exports. No domain abstraction is invented. `shared-config` exposes only a JSON tooling subpath; importing its root into a browser is not supported.
- No shared package imports an application; no API/worker dependency points to web. No app imports server runtime configuration into browser code. Future runtime package consumers must declare actual `workspace:*` dependencies so pnpm can order their builds; do not add unused dependencies or editor-only aliases.
- `pnpm -r build` is topological: shared-config precedes its consumers. `pnpm typecheck` first builds shared outputs; root dev also builds them before launching the apps. Empty shared packages are built but not connected to fake business flows.
- Native build-script permissions are explicit for esbuild and sharp. Nest's optional donation-message postinstall is not needed for runtime. A frozen-lockfile install checks graph consistency; future dependency additions must review their script requirements.

The Step 02 prompt supersedes the older roadmap's inclusion of lint/test/CI and environment validation in this step. Those remain Step 03 pending the user's next scoped instruction; Oracle and all unresolved product Q-IDs are unaffected.
