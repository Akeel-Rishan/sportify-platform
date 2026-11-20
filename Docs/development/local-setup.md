# Local development

Step 02 uses Node 22.22.0 and pnpm 10.34.9. Run commands from the repository root. Use the existing `Docs/` spelling on case-sensitive systems.

## Clean checkout

1. Install/select Node 22.22.0 with your preferred runtime manager. On Unix with nvm installed, `nvm install` and `nvm use` read `.nvmrc`; Windows runtime-manager commands differ. This project does not change system configuration.
2. Confirm `node --version`. Run `pnpm --version` if pnpm exists. Otherwise use `npx --yes pnpm@10.34.9` wherever the commands below say `pnpm`. No global installation is required.
3. Run `pnpm install --frozen-lockfile`.
4. Run `pnpm typecheck` and `pnpm build`. These commands work before generated shared outputs or Next.js route types exist.
5. Run `pnpm dev`. Open http://localhost:3000. Each application has a readable process label. Ctrl+C stops the applications; the runner also stops siblings if an application exits.

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

Scope this override to the API terminal; do not set it globally. Remove it afterwards with `Remove-Item Env:PORT` in PowerShell or `unset PORT` on Unix. No `.env` loader is installed in this step.

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
- **Shared-package edits:** the entry points are empty today. When they contain consumed code, rebuild them after editing; root dev builds them once at startup, not continuously.
- **Hydration warning with an extra `<html style="display: none">`:** on 20 November, a direct request to the development server returned HTTP 200 and `<html lang="en">` without that style. The layout has no root-style mutation, browser branching or changing data. This points to browser-side injection, but the responsible extension/script is not identified. Open the same local URL in a Guest profile or an Incognito window with extensions not permitted there. If the warning disappears, disable extensions for localhost individually to find the injector, then reload. If it persists in an extension-free profile, capture the new hydration diff and compare View Page Source with the Elements root node. Do not add `suppressHydrationWarning` as a fix for a hidden root: suppressing the warning does not remove the injected style. See the [Next.js hydration guidance](https://nextjs.org/docs/messages/react-hydration-error).

Generated output, dependencies, logs, local environment files and wallets are ignored. Do not add real credentials. Oracle connectivity, environment validation, health routes, tests/lint/CI and all business workflows are future work.
