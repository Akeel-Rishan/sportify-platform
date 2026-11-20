# Pull-request quality checks

`.github/workflows/ci.yml` runs on pull requests and pushes to the existing `main` branch. It uses `pull_request`, never `pull_request_target`; repository permissions are read-only and checkout does not retain credentials. It does not deploy, provision cloud infrastructure or connect to production/Oracle.

The `Quality checks` job has a 20-minute timeout. Superseded runs for the same PR/ref are canceled. It checks out source, sets pnpm from `packageManager` and Node from `.nvmrc`, installs with a frozen lockfile, then runs format, lint, typecheck, unit/startup tests with coverage, and all production builds. Required commands fail the job; there is no `continue-on-error` or shell error suppression.

Only the pnpm dependency store is cached, using setup-node's lockfile-aware cache. `node_modules`, `.next` and `dist` are not restored, preserving clean-build detection. Test/coverage diagnostics are uploaded for seven days when they exist, even after failed checks; missing diagnostics do not conceal a failed required step.

Actions are pinned to official release commits with readable version comments:

| Action                  | Release | Verified commit                            |
| ----------------------- | ------- | ------------------------------------------ |
| actions/checkout        | v4.2.2  | `11bd71901bbe5b1630ceea73d27597364c9af683` |
| pnpm/action-setup       | v4.1.0  | `a7487c7e89a18df4991f7f222e4898a00d66ddda` |
| actions/setup-node      | v4.4.0  | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| actions/upload-artifact | v4.6.2  | `ea165f8d65b6e75b540449e92b4886f43607fa02` |

Release tags were resolved against the official GitHub API; pnpm's annotated tag was dereferenced to its commit. Keep pins reviewed when updating. See the official [checkout](https://github.com/actions/checkout), [pnpm setup](https://github.com/pnpm/action-setup), [Node setup](https://github.com/actions/setup-node) and [artifact](https://github.com/actions/upload-artifact) repositories.

No dependency vulnerability scan is configured; a successful quality job is not a security-audit claim. No repository settings or branch protections were changed. After observing a successful remote run, recommend making `Quality checks` required for `main` under the repository's chosen protection policy. Local command/YAML validation does not demonstrate a successful remote Actions run; remote status is recorded separately in progress.
