# Step 11 registration API

D-30 authorizes registration, email verification and the first tenant-owner membership. The API collects the only password after the mailbox holder submits the verification token. Pending accounts carry no credential. The verified user supplies the final owner profile and tenant name. The business legal profile, address and primary sport are collected during onboarding. [Approval](../planning/decision-register.md#d-30--step-11-registration-and-email-verification)

| Method and path                         | Strict JSON body                                        | Success                       |
| --------------------------------------- | ------------------------------------------------------- | ----------------------------- |
| `POST /api/v1/auth/register`            | `email`, `fullName`, `mobile`                           | `202` with `status: accepted` |
| `POST /api/v1/auth/verification/resend` | `email`                                                 | `202` with `status: accepted` |
| `POST /api/v1/auth/verify-email`        | `token`, `password`, `fullName`, `mobile`, `tenantName` | `200` with `status: verified` |

These routes amend the original API §5.1 bodies. The first call accepts an ASCII email trimmed and lowercased for lookup, a nonempty name up to 160 code points, and an E.164 mobile. Confirmation requires the complete owner profile and a tenant name of up to 200 code points. All routes reject unknown fields. The API derives identifiers and roles and never issues a session during signup or verification.

```json
{
  "success": true,
  "data": { "status": "accepted" },
  "requestId": "d7b5ab23-4949-4f91-b3fb-d720337bc3b9"
}
```

Expected shape is the same for duplicate registration, an ineligible resend or an issued verification email. Confirmation substitutes `verified` for `accepted`. Responses use `Cache-Control: no-store` and the existing error envelope and request ID. Unusable tokens receive a generic `400`. A blocked password receives `422 BUSINESS_RULE_VIOLATION`. Throttled requests receive `429 RATE_LIMITED` and `Retry-After`. The short 250–299 ms acknowledgement floor applies after source admission to reduce obvious timing differences. Slow database operations can still exceed it.

## Password and abuse controls

The API enforces 15–128 Unicode code points and 512 UTF-8 bytes, rejects unpaired surrogates, preserves the submitted characters exactly and stores a salted Argon2id PHC string with 19,456 KiB, two iterations and parallelism one. The service allows at most two simultaneous screening/hash operations per process. The work occurs outside Oracle transactions. [OWASP Argon2id guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) · [node-argon2 0.44.0](https://github.com/ranisalt/node-argon2/blob/v0.44.0/README.md)

With Node 22.22.0 on Windows x64 and a Ryzen 7 5800H, 12 sequential synthetic hashes after warmup took 23.1–25.0 ms, with a 23.9 ms median. Two simultaneous hashes took 29.7 ms wall time. This measured hashing only. The target deployment image and ARM64 runtime still need execution and resource measurements.

Supply a vetted local corpus of compromised-password SHA-1 hashes, sorted lexicographically in uppercase with one 40-character hash and LF per record. Prepare and verify full sorting before publishing the file by atomic replacement. The API uses bounded binary search and sends no credential-derived information off host. Hashing fails closed on an unavailable or unreadable corpus. Startup checks the file shape and boundary records; the operator verifies full corpus integrity during preparation. [Corpus source format](https://haveibeenpwned.com/API/v3#PwnedPasswords)

Oracle records a rolling 15-minute account issuance count from token rows and applies a 60-second inter-issuance cooldown. A separate shared source limiter uses 15-minute windows from each scope's first request, initially 10 for register/resend combined and 30 for confirm. It derives a purpose-separated HMAC from the normalized socket peer and never stores the raw address. Proxy headers do not set this identity. Deployments behind a proxy share its peer budget until a specific trusted proxy policy is implemented. The owner can purge expired counter rows through reviewed maintenance of `AUTH_SOURCE_WINDOWS`. Business and audit retention are governed separately.

## Configuration and checks

The routes are disabled by default. Set `AUTH_REGISTRATION_ENABLED=true` only when the migration, reviewed grants, vetted corpus and delivery integration are ready. Configure `AUTH_EMAIL_KEYS`, `AUTH_EMAIL_KEY_VERSION`, distinct `AUTH_SOURCE_KEY`, `AUTH_PASSWORD_BLOCKLIST_PATH` and an operator-reviewed `AUTH_VERIFICATION_OUTBOX_MAX_ATTEMPTS`. `AUTH_ISSUE_SOURCE_LIMIT` and `AUTH_CONFIRM_SOURCE_LIMIT` override the approved initial source values. Keep all secrets outside the checkout and keep owner credentials out of API and worker environments. [Environment example](../../apps/api/.env.example)

### Isolated Oracle verification

Use the existing protected SQLcl wallet and connect as ADMIN to the designated development ATP `fce953xa`. Provision only `SPORTIFY_STEP11_TEST_OWNER`. Set its initial password and unlock it privately in Database Actions, then run the postcondition script. The older Step 10 test owners retain their history.

```powershell
Set-Location -LiteralPath "$env:USERPROFILE/.sportify-secrets/sqlcl-current"
& 'C:/sqlcl/bin/sql.exe' /nolog
```

```sql
SET ECHO OFF
SET VERIFY OFF
SPOOL OFF
SET CLOUDCONFIG Wallet_SPORTIFYDEV.zip
CONNECT ADMIN@sportifydev_low
VARIABLE expected_db_unique_name VARCHAR2(128)
VARIABLE operator_confirmation VARCHAR2(32)
VARIABLE owner_quota_mb NUMBER
EXEC :expected_db_unique_name := 'fce953xa';
EXEC :operator_confirmation := 'DISPOSABLE_STEP11_OWNER';
EXEC :owner_quota_mb := 256;
@"C:/Users/ROG STRIX G15/Desktop/sportify-platform/database/provisioning/provision-step11-test-owner.sql"
```

After setting the password, run the postconditions from the same verified ADMIN session. If it was closed, reconnect and redeclare the target and quota binds and their values.

```sql
@"C:/Users/ROG STRIX G15/Desktop/sportify-platform/database/provisioning/verify-step11-test-owner.sql"
```

For a fresh setup, fill the owner password privately in `$env:USERPROFILE/.sportify-secrets/oracle-step11-tests.env`. The existing file was prepared with the wallet and runtime settings. The [protected env template](../../database/provisioning/step11-test-migrations.env.example) lists the required variables. From the repository root:

```powershell
npx --yes pnpm@10.34.9 build
node --env-file="$env:USERPROFILE/.sportify-secrets/oracle-step11-tests.env" database/tests/oracle-step11.mjs
```

The suite installs 27 migrations on a verified empty owner, tests duplicate signup, confirmation, replay, resend races, rollback, role isolation, grants and captured local delivery, and verifies cleanup. Successful tests keep the migration ledger. Use `--resume-after-install` to exercise the workflows again only after the isolated owner has the exact 27-migration catalog and zero fixtures or grants to either runtime account. After a failure, inspect the retained state before any new run. Keep application-owner migration and application grants out of this isolated command.

### Verification record

28 November 2026. **Step 11 engineering is owner-approved and the controlled development integration passed.** Results apply to the working tree based on `dbf3251`. The closure review records three consecutive instrumented passes in the disposable schema. [Final engineering review](step11-final-engineering-review.md) · [Redacted isolated evidence](evidence/step11-concurrency-redacted.json) · [Development verification](step11-development-integration.md#integration-checkpoint)

| Layer                            | Result  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local checks                     | PASS    | Frozen install, lint, strict type checks and production builds. All 226 local tests passed, including 4 registration HTTP cases and 8 new password, config and delivery cases. Coverage reached 91.98% lines overall and 90.90% for the API auth module.                                                                                                                                                                           |
| Compiled API                     | PASS    | Compiled health and registration requests and clean shutdown with a stub database.                                                                                                                                                                                                                                                                                                                                                 |
| Local verification mail          | PASS    | Controlled loopback sink received the correct recipient and fragment link using a stub for the eligible Oracle row.                                                                                                                                                                                                                                                                                                                |
| Oracle foundation                | PASS    | Read-only `oracle-step10.mjs --baseline` reconfirmed 26 applied migrations, the exact installed catalog and both seed catalogs. Original 26 manifest entries and 239 SQL and seed files are unchanged.                                                                                                                                                                                                                             |
| Step 11 on Oracle                | PASS    | The first run applied migrations `000001` through `000027` on the disposable owner. The successful continuation reverified the catalog, confirmed a no-op migration repeat, and passed runtime denials, signup and confirmation races, worker delivery to the local sink, resend and expiry, injected rollback and retry, tenant role isolation, rate limits and redaction. Checks found zero leftover fixtures or runtime grants. |
| External delivery and deployment | Pending | The dispatcher and provider are outside the verified local adapter. Provider acceptance, actual inbox receipt and ARM64 remain untested.                                                                                                                                                                                                                                                                                           |

Initial attempts exposed a test assertion that needed to recognize Oracle's missing-privilege code and a reserved SQL bind name in the registration service. A subsequent signup race failed once after one synthetic signup committed. A rollback-only probe successfully registered a synthetic account, and the race passed on the next instrumented run. The earlier race failure's cause remains unconfirmed. Continuations removed only inspected synthetic fixtures and preserved all installed migration records. [Oracle privilege error reference](https://docs.oracle.com/en/error-help/db/ora-41900/) · [Oracle bind error reference](https://docs.oracle.com/en/error-help/db/ora-01745/)

The source audit found no configured secrets or private material in changed files. The local coverage and compiled smoke use test doubles for the Oracle repository. The live workflow suite used the isolated Step 11 owner and the actual API and worker identities. The application owner now has verified migration `000027` and the exact reviewed grants. Public registration and external email delivery retain their separate gates. [Development verification](step11-development-integration.md#integration-checkpoint)

### Manual verification checklist

- Create a synthetic pending account twice and compare the generic responses. Confirm that Oracle has one account, no tenant and no pending password.
- Capture the mail in the local sink. Open the link without consuming it, then send the explicit confirmation POST using the mailbox holder's chosen profile and password.
- Check one active owner membership, no session, one pending-onboarding tenant and zero staff role assignments. Replay the token and expect a generic `400`.
