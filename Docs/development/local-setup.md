# Local development

Step 06 retains Node 22.22.0 and pnpm 10.34.9. Run commands from the repository root. Use the existing `Docs/` spelling on case-sensitive systems. See [environment configuration](environment-configuration.md) and [testing](testing.md) for the added startup and quality boundaries.

## Clean checkout

1. Install/select Node 22.22.0 with your preferred runtime manager. On Unix with nvm installed, `nvm install` and `nvm use` read `.nvmrc`; Windows runtime-manager commands differ. This project does not change system configuration.
2. Confirm `node --version`. Run `pnpm --version` if pnpm exists. Otherwise use `npx --yes pnpm@10.34.9` wherever the commands below say `pnpm`. No global installation is required.
3. Run `pnpm install --frozen-lockfile`.
4. Run `pnpm check` for format, lint, typecheck, tests and production build. `pnpm test:coverage` adds scoped coverage gates. These commands work before generated shared outputs or Next.js route types exist.
5. Securely configure both restricted Oracle runtime environments following [secure connectivity](../database/secure-connectivity.md) and [provisioning](../../database/provisioning/README.md). Without a designated target, use `pnpm dev:web` independently; API/worker intentionally fail on missing database configuration. Once configured, run `pnpm dev`. Open http://localhost:3000. Each application has a readable process label. Ctrl+C stops the applications; the runner also stops siblings if an application exits.

## Independent applications

```sh
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

Use a separate terminal for each. Web defaults to port 3000; API defaults to 4000. Worker exposes no HTTP listener and prints that no jobs are configured. API `/` or any unimplemented route returns 404. The web page makes no API request.

The API accepts integer `PORT` values from 1 to 65535. For example, PowerShell:

```powershell
$env:PORT = '4100'
pnpm dev:api
```

Unix shell:

```sh
PORT=4100 pnpm dev:api
```

Scope this override to the API terminal; do not set it globally. Remove it afterwards with `Remove-Item Env:PORT` in PowerShell or `unset PORT` on Unix. API/worker development loads application-relative `.env.local` then `.env`, with existing process values taking precedence. Tests/production with an explicit mode skip those files. No real env file is required; optional safe examples are provided.

For a web port override, invoke Next directly through its local workspace command: `pnpm --filter @sportify/web exec next dev --port 3100`.

## Production entry points

```sh
pnpm build
pnpm --filter @sportify/web start
pnpm --filter @sportify/api start
pnpm --filter @sportify/worker start
```

Run the start commands in separate terminals. API/worker run compiled JavaScript with Node, without ts-node or tsx. Web uses Next's production server. Ctrl+C performs normal termination. Worker releases its idle timer for SIGINT/SIGTERM. On Windows a forced process-tree termination may bypass signal handlers; use Ctrl+C for interactive shutdown and verify target Linux signal behavior before deployment.

## Troubleshooting

- **pnpm not found:** use the exact npx fallback above. Do not install a global framework CLI.
- **Engine/version mismatch:** select the pinned runtime and package manager. Do not bypass strict peer validation to conceal incompatibilities.
- **Port occupied:** stop the process you started, or choose an alternate local port. Do not terminate unrelated applications. The API reports startup failure if its port is invalid or occupied.
- **Missing package dist/types:** run `pnpm build:packages`. Root build/typecheck already do the necessary ordering. New runtime consumers must declare `workspace:*` dependencies; no relative imports across applications.
- **Install permission/network errors:** retry from a permitted terminal/network; do not alter machine security settings or commit registry credentials. Approved native install scripts are limited to esbuild and sharp.
- **Production web not built:** run `pnpm build`; development output alone is not a production build. Avoid running web dev and production build simultaneously against the same `.next` directory.
- **Shared-package edits:** validation now contains consumed code. Rebuild shared packages after editing; development/watch-test startup builds them once, not continuously.
- **Hydration warning with an extra `<html style="display: none">`:** on 20 November, a direct request to the development server returned HTTP 200 and `<html lang="en">` without that style. The layout has no root-style mutation, browser branching or changing data. This points to browser-side injection, but the responsible extension/script is not identified. Open the same local URL in a Guest profile or an Incognito window with extensions not permitted there. If the warning disappears, disable extensions for localhost individually to find the injector, then reload. If it persists in an extension-free profile, capture the new hydration diff and compare View Page Source with the Elements root node. Do not add `suppressHydrationWarning` as a fix for a hidden root: suppressing the warning does not remove the injected style. See the [Next.js hydration guidance](https://nextjs.org/docs/messages/react-hydration-error).

Generated output, dependencies, logs, test reports, coverage, local environment files and wallets are ignored. Do not add real credentials. Environment validation and quality checks now exist; The API now serves shared HTTP conventions and Oracle-required readiness; connectivity code exists, actual Oracle verification is blocked, and deployment/business workflows remain future work. See [API conventions](../api/conventions.md). Local tests do not demonstrate a remote GitHub Actions pass.

## Step 06 database prerequisite

Installation, formatting, static checks, mock-backed tests and production builds work without Oracle. API/worker starts now require their separate credentials and the selected mTLS target and a protected instance wallet. Do not fabricate credentials to claim a working local stack. Development examples live in each app; replace placeholders only in ignored, OS-protected files, preserving any existing files. Production NODE_ENV skips local files. Do not echo environment values to troubleshoot.

`pnpm dev:web` still runs the unchanged responsive foundation independently. Once authorized Oracle configuration exists, use `pnpm dev:api` and `pnpm dev:worker`, or `pnpm dev` for all three; Ctrl+C invokes application shutdown and bounded pool drain. Do not run production API start and dev API simultaneously on port 4000. An occupied port is separate from Oracle readiness; inspect the owning process and stop only the instance you intended to replace.

A valid minimum-zero pool may initialize while Oracle is unavailable: health remains 200, ready is safe 503 until the bounded probe succeeds. Invalid env fails before startup with variable names/rules only. TLS failures require operator confirmation of target access/certificate/mode; never disable verification, open network access or print descriptors as a workaround. A Windows hard kill may bypass cleanup; restart after the operating system releases resources. See [pool lifecycle](../database/connection-pooling.md).

### mTLS follow-up

The user selected Secure access from everywhere with required mTLS for changing laptop IPs. Download/extract the **instance wallet outside the checkout**, following [wallet setup](../database/secure-connectivity.md#instance-wallet-setup). Supply ORACLE_WALLET_DIRECTORY and ORACLE_WALLET_PASSWORD privately to both runtimes, alongside their separate Oracle usernames/passwords. Use the exact mTLS host/port/service in ORACLE_CONNECT_STRING. Never use ADMIN in app envs. Readability validation happens before pool creation; missing/empty/invalid wallet errors name the field without disclosing material or paths. A readable PEM is not proof of a successful handshake. No local secret file has been created or populated by this follow-up.

## Step 07 operator tooling

`pnpm db:plan` works locally without secrets and reports current artifact/review status, not Oracle validation. `pnpm db:status`, `pnpm db:migrate` and `pnpm db:verify` use separate migration-only process configuration and compiled local dependencies. They never load the API/worker .env files, run on application startup, provision accounts or create cloud infrastructure. Do not inject owner passwords into API/worker terminals/files. Current mutation/verification commands fail before connection while the manifest is under review. Follow [migration guide](../database/migration-guide.md) after the pending structural decisions and real Step 06 prerequisites are resolved.

The explicit real runner command is `pnpm test:oracle:runner` and requires an empty isolated SPORTIFY_TEST_OWNER plus disposable-target confirmation; it is not ordinary local setup and must never target the application owner. All application commands and the web foundation are otherwise unchanged. Use the existing pinned `npx --yes pnpm@10.34.9` fallback.

Step 07 resumption: build packages first, then optionally use Node's explicit `--env-file="<protected-owner-file>"` with the operator scripts. The locally prepared migration-only configuration is outside source and requires its separately supplied owner password; it is never loaded by API/worker. A different protected test-owner configuration and dedicated empty test schema are required for `test:oracle:step07`. Root `db:lock-check` verifies the owner-only lock capability separately from business migrations. Review [setup and blocked gates](../database/migration-guide.md); D-18 approves the ready manifest, but actual owner locking, disposable-test setup and Oracle execution gates remain mandatory.

Step 07 is installed and verified on the existing designated development target; [dated evidence](../database/step07-verification.md) records commands, retained disposable fixtures and limits. Use protected status/verify commands for that installed schema; do not rerun account preparation or treat the used test owner as empty. Application runtime environments remain separate from migration secrets.
