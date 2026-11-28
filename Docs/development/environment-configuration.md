# Environment configuration

## Step 13 authority and local testing

`NODE_ENV` selects the host policy, and `PORT` determines the allowed direct development probe port. The canonical dashboard account origin is `https://app.sportify.lk`. `AUTH_DASHBOARD_ORIGIN` and `AUTH_ALLOW_LOOPBACK_HTTP` retain the documented local account behavior. The tenant suffix and reserved labels are fixed in the application. Express proxy trust stays disabled. [Host and local setup](../security/host-and-proxy-trust.md)

## Step 12 account authentication

`AUTH_ACCOUNT_ENABLED` defaults to disabled independently of Step 11 registration. The enable path requires the exact dashboard origin, independent CSRF and reset keys, reset key version, shared source counter key, local compromised-password corpus, login pair and session source limits, and reset outbox budget. The example lists the approved configurable defaults for session/reset timings and login/reset source limits. Production requires HTTPS. The separate loopback HTTP exception is valid only in test or development mode. [API environment example](../../apps/api/.env.example) · [Browser and proxy contract](../auth/browser-security.md)

Step 11 adds opt-in API registration settings, externally supplied versioned verification keys, a distinct source-counter key and a local compromised-password corpus. Startup validates the configured corpus before enabling routes. See the [Step 11 configuration](../auth/registration.md#configuration-and-checks) and [delivery key rotation](../auth/email-verification.md#dispatch-and-key-operations).

Step 06 adds required Oracle runtime configuration to API and worker. Email, OCI, authentication and frontend API URL configuration remain deferred. Configuration errors name the variable and its rule, without echoing values or dumping environment objects.

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

## Step 06 server-only Oracle variables

API/worker executable loaders now return base configuration plus `database`, parsed before allocating resources. Base NODE_ENV/PORT parsers remain independently testable. The same process > .env.local > .env precedence applies to Oracle values. Missing credentials fail startup; ordinary builds/tests require no real secrets. Do not copy owner/ADMIN credentials into either app. Placeholders in examples deliberately cannot establish a real connection.

| Variable                 | API / worker rule and absent default                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| ORACLE_USER              | Required exact SPORTIFY_API / SPORTIFY_WORKER respectively                                                      |
| ORACLE_PASSWORD          | Required nonempty protected password, maximum 1024 characters; never returned to HTTP/logs                      |
| ORACLE_WALLET_DIRECTORY  | Required absolute directory containing a readable, nonempty regular ewallet.pem; outside the checkout           |
| ORACLE_WALLET_PASSWORD   | Required nonempty separately supplied instance-wallet decryption password, maximum 1024 characters              |
| ORACLE_CONNECT_STRING    | Required option-free `tcps://host:port/service`, valid port 1-65535 from the actual mTLS connection information |
| ORACLE_SCHEMA_OWNER      | Fixed allowlisted SPORTIFY_SCHEMA_OWNER; default same; no arbitrary SQL identifier                              |
| ORACLE_POOL_MIN          | Integer 0 through maximum; default 0                                                                            |
| ORACLE_POOL_MAX          | API 1-8 default 8; worker 1-2 default 2                                                                         |
| ORACLE_POOL_INCREMENT    | Integer 1 through maximum; default 1                                                                            |
| ORACLE_POOL_IDLE_SECONDS | Integer 10-3600; default 60                                                                                     |
| ORACLE_QUEUE_TIMEOUT_MS  | Integer 100-5000; default 1500                                                                                  |
| ORACLE_CALL_TIMEOUT_MS   | Integer 100-5000; default 1500 per round-trip                                                                   |

No ORACLE variable is public or belongs in NEXT_PUBLIC/shared-config. Config objects hold secrets in process memory: never serialize them into props, logs or diagnostic dumps. No password/descriptor values appear in validation errors. The user-selected mTLS implementation requires protected wallet material; wallet setup and [driver evidence](../database/secure-connectivity.md) are documented without a walletless fallback or second config branch. Production must inject credentials externally. [Rotation](../../database/provisioning/README.md) recreates pools through process restart. Live verification has its own explicit designation/password variables documented in [Oracle verification](../database/oracle-verification.md); those are not app config.
