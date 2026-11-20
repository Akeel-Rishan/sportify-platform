# Environment configuration

The application validates only configuration currently consumed by the scaffold. No Oracle, email, OCI, authentication or API URL variable is required. Configuration errors name the variable and its rule, without echoing values or dumping environment objects.

| Application | Variable                   | Absent default              | Accepted explicit values                                    |
| ----------- | -------------------------- | --------------------------- | ----------------------------------------------------------- |
| API         | `NODE_ENV`                 | `development`               | `development`, `test`, `production`                         |
| API         | `PORT`                     | `4000`                      | Decimal digits representing an integer from 1 through 65535 |
| Worker      | `NODE_ENV`                 | `development`               | `development`, `test`, `production`                         |
| Web         | None owned by SPORTIFY yet | Empty public/server objects | Next.js manages its framework variables                     |

An explicit empty string is invalid for both supported variables. Whitespace, a fractional number, a sign, scientific notation, nonnumeric suffixes and out-of-range ports are rejected. Unknown process variables are ignored and never returned in typed configuration. Leading zeroes are accepted as decimal digits; no partial parsing is performed.

## Loading and precedence

API and worker load configuration once at their executable boundary. Pure parsers accept an explicit environment object and do not read files or process state. The loaders copy their injected environment, preserving the caller's object and the original process environment.

If the initial `NODE_ENV` is absent or `development`, precedence is:

1. Existing process environment, including explicitly empty values.
2. The application's `.env.local`.
3. The application's `.env`.
4. Defaults for absent supported variables.

File names are resolved against the application directory using the config module's location, never the caller's working directory. `src/config` and compiled `dist/config` share that directory relationship. Missing files are allowed; unreadable files fail safely. Files contain no executable instructions and variable expansion is not enabled.

An injected `NODE_ENV=production` or `test` skips development files entirely. Production must inject its configuration; tests pass explicit values. Test helpers restore any scoped environment changes. A file-supplied mode does not change the already-selected file-loading pass; normal local examples keep `NODE_ENV=development`.

Safe examples are `apps/api/.env.example` and `apps/worker/.env.example`. Copy an example manually only if local overrides are needed. Real `.env*` files remain ignored; `.env.example` remains trackable. No real local env file is required or created by setup.

## Public and server boundaries

`apps/web/src/config/public-env.ts` is an explicit empty public allowlist. `server-env.ts` imports `server-only`, so Next.js rejects a client dependency on that module. The lint configuration also rejects direct server-config imports in a file with a `use client` directive. No framework or server runtime environment is exported through `@sportify/shared-config`; that package remains tooling-only.

Next.js loads web env files through its [supported behavior](https://nextjs.org/docs/app/guides/environment-variables). There is no second dotenv loader in web. Future `NEXT_PUBLIC_*` values must be deliberately allowlisted and referenced statically: they are public and may be embedded at build time, not protected secrets or automatically runtime-refreshable configuration. Never spread `process.env` into client props/configuration.

## Running and failures

Root scripts, workspace-filtered commands and `node apps/api/dist/main.js` / `node apps/worker/dist/main.js` all use the same app-relative boundary. Build shared packages before directly running compiled entry points. Development scripts and root build/typecheck already do the necessary dependency ordering after a fresh install.

PowerShell API override:

```powershell
$env:NODE_ENV = 'development'
$env:PORT = '4100'
npx --yes pnpm@10.34.9 dev:api
```

Unix equivalent:

```sh
NODE_ENV=development PORT=4100 pnpm dev:api
```

If startup fails, read the named variable rule and correct the source with highest precedence. An invalid explicitly supplied value does not fall back to a valid file/default. Remove temporary terminal overrides after use. Nonconfiguration startup failures retain a generic safe message; HTTP request errors now use the [Step 04 safe error conventions](../api/errors.md); startup errors remain separate from HTTP responses.
