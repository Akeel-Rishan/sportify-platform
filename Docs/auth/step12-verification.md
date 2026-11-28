# Step 12 verification

**PASS — OWNER-APPROVED.** On 28 November 2026 the complete isolated Step 12 suite exited 0 on development ATP `fce953xa` as `SPORTIFY_STEP12_TEST_OWNER`. The working tree is based on `2e61eda`. The owner subsequently approved the engineering evidence and authorized controlled development integration under D-34. Both public account flags remain disabled. [Account API](login-and-logout.md) · [Decision D-34](../planning/decision-register.md#d-34--step-12-final-approval-and-development-integration-authorization) · [Application integration](step12-development-integration.md)

## Evidence

| Check                         | Result  | Evidence                                                                                                                                                                                                                     |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quality                       | PASS    | Lint, strict types, 238 tests across 31 files and production builds. Coverage met the configured gates with 92.67% lines overall and 93.39% for the API auth module. Formatting passed for tracked and new repository files. |
| Account HTTP                  | PASS    | Six real Nest/Express HTTP tests with a database double cover credential equivalence, CSRF/Origin/Host, cookie scope, logout, safe DB failure, generic reset and reset confirmation.                                         |
| Chromium                      | PASS    | Chromium 158 tested the compiled browser boundary over HTTPS on sibling hosts. The secure HttpOnly cookie stayed on the dashboard. Cross-origin logout and preflight failed. Same-origin logout cleared the cookie.          |
| Controlled mail               | PASS    | Both adapters delivered synthetic messages to a loopback sink using fixture rows. The reset adapter refused a verification-purpose digest and an ineligible row.                                                             |
| Compiled lifecycle            | PASS    | The application entrypoints passed Oracle readiness and shut down with one pool closure each. An enabled-route smoke with a database double checked CSRF bootstrap, missing-session rejection and shutdown.                  |
| Read-only Oracle baseline     | PASS    | Development fce953xa has the exact 27-migration application catalog. All 27 original manifest entries and 248 SQL/seed artifacts match Git. Migration 000028 is the sole pending version.                                    |
| Live Oracle workflow          | PASS    | Applied all 28 migrations to the verified empty owner, checked the exact catalog and no-op replay, and passed the complete workflow, rollback, concurrency, runtime grant and cleanup suite.                                 |
| External delivery and ingress | PENDING | D-33 approved the intended origin and initial policy. Trusted ingress, remaining operational limits, dispatcher, provider acceptance, inbox and deployed ARM64 evidence are pending.                                         |

Repository-wide `pnpm check` stopped when Prettier encountered an inaccessible Step 10 temporary directory. Formatting of tracked and new files and the separate lint, typecheck, coverage and build runs passed. The source audit found zero configured-secret matches or private files. The compiled enabled-route smoke passed with a database double that implements the shutdown hook.

Approved defaults are 12 hours absolute session lifetime, 30 minutes idle, a one-minute minimum touch interval and independent devices. Reset defaults are 30-minute links, 60-second cooldown, three issuances per 15 minutes per account and atomic replacement revocation. The source defaults per 15 minutes are 30 login attempts, 10 reset requests and 30 confirmations. [Session policy](server-side-sessions.md) · [Reset policy](password-reset.md) · [Browser contract](browser-security.md)

## Live Oracle evidence

The operator verified password authentication, open status, exact grants, the 256 MB quota and the empty schema. After the protected file was saved, `oracle-step12.mjs` applied versions `000001` through `000028` in order and returned an empty apply list on replay. The catalog matched 50 tables, 575 table columns, 470 named constraints, 103 explicit indexes and four views, including the read-only reset-mail view.

- **Account and sessions.** A verified owner with an active membership in a `PENDING_ONBOARDING` tenant signed in and received a public account profile. The tenant status and empty subscription state were preserved. Ineligible accounts and invalid credentials returned equivalent public errors. The test verified digest-only session storage, independent devices, absolute and idle expiry, bounded touches and dashboard audience isolation.
- **Logout and session race.** Logout revoked the current device and preserved other sessions. Repeated logout succeeded. A real Oracle error injected after the revocation write caused rollback and an error response even though the browser cookie was cleared. A paused session touch resumed after logout committed on a different Oracle session. It returned unauthorized and did not change the revoked session's timestamps.
- **Reset and concurrency.** Two concurrent requests produced one link during cooldown. The rolling account cap suppressed further issuance. An eligible replacement made the prior link unusable, including when confirmation had already read it and was waiting on the account lock. The worker reconstructed the current link and sent it to a synthetic loopback inbox. Expired, revoked, used and verification-purpose tokens could not complete reset. Two simultaneous confirmations produced one success and no session. An old-password login paused before its account lock and resumed after reset committed. It failed, while a login with the new password succeeded.
- **Rollback, privacy and runtime privileges.** An injected Oracle failure during reset rolled back the password, token, session and audit changes and left no completion event. The API and worker identities, exact temporary grants and eight denial probes passed. Secret sentinel checks passed. Both pools released their connections and closed once. Fixture rows and temporary grants were removed.
- **Independent read-only postchecks.** The disposable owner retained exactly 28 applied ledger entries with zero pending migrations or residual fixtures and grants. The normal application owner retained exactly 27 applied migrations and only `000028` pending. Its catalog remained at 50 tables, 573 columns, 468 named constraints and one view. Both catalogs retained eight sports and 20 permissions.

## Isolated Oracle verification

Use only the designated disposable Step 12 owner on development ATP `fce953xa`. The test retains migration history and removes its synthetic data and temporary grants. Earlier test and application owners keep their current histories.

Operator provisioning and ADMIN verification have passed. The SQL below records the completed provisioning procedure.

```sql
SET CLOUDCONFIG Wallet_SPORTIFYDEV.zip
CONNECT ADMIN@sportifydev_low
VARIABLE expected_db_unique_name VARCHAR2(128)
VARIABLE operator_confirmation VARCHAR2(32)
VARIABLE owner_quota_mb NUMBER
EXEC :expected_db_unique_name := 'fce953xa';
EXEC :operator_confirmation := 'DISPOSABLE_STEP12_OWNER';
EXEC :owner_quota_mb := 256;
@"C:/Users/ROG STRIX G15/Desktop/sportify-platform/database/provisioning/provision-step12-test-owner.sql"
```

Set the disposable user's initial unique password and unlock it privately. Keep database web access off. With the same verified ADMIN connection and binds, run `database/provisioning/verify-step12-test-owner.sql` from SQLcl using the absolute repository path. The script expects the exact least-privilege grants and an empty schema.

The passed run used the protected file `$env:USERPROFILE/.sportify-secrets/oracle-step12-tests.env`. The [environment template](../../database/provisioning/step12-test-migrations.env.example) documents the required fields. The initial-install commands below are retained for an authorized empty disposable schema:

```powershell
npx --yes pnpm@10.34.9 build
node --env-file="$env:USERPROFILE/.sportify-secrets/oracle-step12-tests.env" database/tests/oracle-step12.mjs
```

Use `--resume-after-install` for an already verified isolated 28-migration install with no fixtures or temporary runtime grants. Inspect any prior partial state before restarting. Never clean up an unknown user or schema.

## Manual review

- Bootstrap a CSRF proof, log in with a synthetic verified account and confirm `/auth/me` shows its public profile.
- Log in from two isolated browsers. Sign out from one with a fresh proof and confirm the other remains signed in.
- Request a reset using the local sink. Follow the fragment link without consuming it, then confirm through the explicit POST. Check that both prior sessions fail and the new password can log in.
- Repeat a cross-origin mutation from a sibling host. It must fail while legitimate same-origin requests continue.

The live suite's read-only postcheck found the application schema at `000027`. The application integration report tracks subsequent maintenance checks and execution under D-34. Public registration and account routes stay disabled through the remaining rollout gates. [Controlled development integration](step12-development-integration.md)
