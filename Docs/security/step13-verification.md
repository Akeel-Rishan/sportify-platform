# Step 13 verification

**Verified, passed and owner-approved for application-level and development Oracle scope.** The complete live workflow passed on the designated disposable Oracle owner. D-36 retains mandatory pre-production ingress and activation gates. [Owner decision](../planning/decision-register.md#d-36--step-13-final-owner-approval) · [Tenant model](tenant-resolution.md) · [Repository boundary](tenant-scoped-repositories.md)

## Evidence

28 November 2026. Working tree based on `0829966`.

| Check                               | Status  | Evidence                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local quality                       | PASS    | All 280 tests across 33 files passed. The 35 dedicated unit authority cases and seven Nest HTTP tenant cases passed. Line coverage was 93.44% overall and 96.82% in the tenancy module. Configured coverage thresholds, lint, workspace type checks and production builds passed.                                                                                   |
| Real HTTP and local proxy           | PASS    | Raw Node TCP sent missing, duplicate, comma and absolute-form authority requests and a late duplicate. A loopback Node reverse proxy preserved the wire Host and stripped competing forwarding values. Membership, mutation CSRF and bound SQL tests use a database double.                                                                                         |
| Compiled API smoke                  | PASS    | The compiled factory started, answered eight literal-Host cases, reported ready against development Oracle and shut down. Both public auth flags were disabled and proof routes were absent. The initial smoke client substituted the loopback Host. The corrected run used the Node HTTP client with explicit wire Host.                                           |
| Read-only Oracle baseline           | PASS    | Development catalog and reference seed verification passed. The application ledger has 28 applied entries with zero pending. The manifest and all 257 SQL and seed files match the Git baseline.                                                                                                                                                                    |
| Isolated Oracle repository workflow | PASS    | A clean install applied all 28 migrations. The successful continuation verified the exact catalog and no-op replay, 17 temporary API grant statements and five access denials, distinct concurrent Oracle sessions, published-only projections, tenant-scoped CRUD and bulk operations, rollback, membership and state checks, one-session pool reuse, and cleanup. |
| Actual deployment ingress           | PENDING | Real Nginx/Cloudflare, trusted origin access, TLS and cache behavior await a configured deployment test.                                                                                                                                                                                                                                                            |

The repository-wide Prettier command exits with `EPERM` while enumerating the ignored `tmp/step05-python/pypdf` directory. Formatting passed across the 584 tracked and unignored new paths enumerated by Git, in batches with `prettier --check --ignore-unknown` and repository ignore rules. This is the documented Windows verification method while the directory is inaccessible. [Testing instructions](../development/testing.md#step-13-tenant-resolution)

The verified SQLcl provisioning transcript recorded the disposable owner's initial authentication, exact grants, quota and empty schema. The initial run applied all 28 migrations. Its next check counted the default user-level `INHERIT PRIVILEGES` grant to `PUBLIC` as a schema object grant. The harness now excludes that exact default entry from its schema grant comparison. A subsequent fixture insert exposed the required business-sport foreign key. The corrected fixtures enable a different sport for each business, and the resource insert now requires an active sport association for its scoped business. [Oracle default user grant](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbseg/controlling-invokers-rights-privileges-procedure-calls-and-view-access.html)

An intermediate run passed the read and concurrency proof, then the write sequence hit the 15-second HTTP deadline. The successful continuation used a 45-second deadline for the test-only multi-statement POSTs. Oracle acquisition and individual calls retained their five-second limits, and the two-session barrier retained its ten-second limit. The failed attempts passed cleanup after fixtures or grants had been staged. The final closeout reran all 280 tests, coverage, lint, the API type check and build, the compiled API smoke, and the full isolated Oracle workflow after tightening the bootstrap and grant check. Each passed.

## Final source and security review

- The API bootstrap requires a host policy. It runs wire Host validation with Express proxy trust disabled and requires the correct request-bound scope for tenant namespace handlers. Public website slugs, dashboard session and membership checks, and separate administration and probe surfaces were reviewed against the original Step 13 prompt. Proof controllers are confined to test modules. The scope comes from server resolution and repository predicates, and authenticated responses use `no-store`.
- Resource inserts derive tenant and business ownership from the scoped location and require an active business-sport row for that same tenant and business. Rename, deactivate and delete bind the current tenant and recheck membership and tenant state. They leave tenant, business, location and sport keys intact for surviving rows. Composite foreign keys enforce the resource relationships. The bulk path checks every requested ID in the selected tenant.
- The 45-second deadline appears only in the Oracle test HTTP client. Production request timeout settings and shared Oracle pool configuration were reviewed against Git. The shared Oracle queue and call settings retain 1,500 ms defaults and 5,000 ms upper bounds. The local API configuration resolved both public registration and account routes as disabled.
- The grant exception matches only the local, direct `USER` entry for `INHERIT PRIVILEGES` on the current owner, issued by that owner to `PUBLIC`, with no grant option, hierarchy, common or inherited flag. All other rows participate in the exact object and column grant checks. The independent catalog read confirmed that automatic entry and zero other outgoing grants after cleanup. [Oracle default user grant](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbseg/controlling-invokers-rights-privileges-procedure-calls-and-view-access.html)
- The closeout scanned all 34 changed and new paths for configured secret values and private files, with zero matches. The compiled API contained neither proof controllers nor the test deadline. The application migration manifest and all 257 SQL and seed files matched Git.

## Mandatory pre-production gates

Prove deployed Nginx and Cloudflare ingress, direct-origin restrictions, header handling, public and origin TLS, and cache separation across hosts and authentication states. Complete the Step 11 and Step 12 authentication and email delivery gates, including staging source limits, dispatch and retry recovery, provider acceptance, inbox delivery, secret rotation, ARM64 deployment smoke and rollback. Public registration and account routes require separate release approval after these gates. [Ingress acceptance](host-and-proxy-trust.md#deployment-acceptance) · [Email acceptance](../auth/email-verification.md#delivery-and-deployment-acceptance) · [Authentication release prerequisites](../auth/step12-development-integration.md#release-prerequisites)

## Live Oracle results

- A synthetic account with two active memberships made simultaneous requests to its two tenant URLs. The suite observed separate Oracle sessions at the membership lookup. Each tenant returned its own resources, join results, counts and totals, and returned no row for the other's resource UUID. The administrator session and a tenant-website host could not open the private route. Unmapped and unpublished websites returned 404.
- The resource transaction rejected foreign location and resource identifiers, a sport enabled exclusively for the other business, and a mixed-tenant batch. It inserted, renamed, deactivated and deleted its own resource. An intentional failure rolled back a preceding rename and insert, leaving both original resource records intact. The suite rejected nested access to the other tenant and calls through the transaction facade after closure.
- Revoking a membership removed private access on the next request. Suspended tenants retained authorized reads and eligible published display, with resource writes denied. Repeated alternating reads on one Oracle session retained their explicit tenant scope. Pools released their connections and closed, and logs omitted secret and private projection sentinels.
- Independent checks verified both owners against the 28-migration manifest. Each had 50 tables, eight sports and 20 permission seeds, with zero pending migrations. The disposable owner retained zero fixture rows and zero outgoing schema object or column grants.

## Isolated Oracle workflow

The harness accepts only `SPORTIFY_STEP13_TEST_OWNER` on development ATP `fce953xa`. It installs or verifies all 28 original migrations, checks no-op replay and verifies the disposable catalog and empty non-reference tables before creating any fixtures. It temporarily grants the API exactly the permissions used by the tests. It runs two synthetic tenants through the compiled guards, Step 12 session lookup and real repository SQL, then removes synthetic rows and test grants while retaining the ledger. It preserves the application schema and the earlier disposable owners.

The commands below record the completed provisioning procedure. SQLcl prompts privately for the password. Run the provisioning script only for a freshly authorized owner.

```powershell
Set-Location -LiteralPath "$env:USERPROFILE/.sportify-secrets/sqlcl-current"
& 'C:/sqlcl/bin/sql.exe' /nolog
```

```sql
SET CLOUDCONFIG Wallet_SPORTIFYDEV.zip
CONNECT ADMIN@sportifydev_low
VARIABLE expected_db_unique_name VARCHAR2(128)
VARIABLE operator_confirmation VARCHAR2(32)
VARIABLE owner_quota_mb NUMBER
EXEC :expected_db_unique_name := 'fce953xa';
EXEC :operator_confirmation := 'DISPOSABLE_STEP13_OWNER';
EXEC :owner_quota_mb := 256;
@"C:/Users/ROG STRIX G15/Desktop/sportify-platform/database/provisioning/provision-step13-test-owner.sql"
```

Set the new owner's unique password and unlock it privately in Database Actions with web access off. Verify the postconditions in the same ADMIN session. The verification script requires the target, quota and confirmation binds above.

```sql
@"C:/Users/ROG STRIX G15/Desktop/sportify-platform/database/provisioning/verify-step13-test-owner.sql"
```

Fill `ORACLE_MIGRATION_PASSWORD` in the protected `$env:USERPROFILE/.sportify-secrets/oracle-step13-tests.env`. Reuse the approved wallet and runtime identity settings. [Protected template](../../database/provisioning/step13-test-migrations.env.example)

```powershell
npx --yes pnpm@10.34.9 build
node --env-file="$env:USERPROFILE/.sportify-secrets/oracle-step13-tests.env" database/tests/oracle-step13.mjs
```

`--resume-after-install` requires a verified 28-migration catalog with zero non-reference fixture rows and outgoing grants. Inspect any partial state before resuming. Keep passwords and raw Oracle or wallet connection details in the protected environment.

## Manual checklist

- Check the health endpoint with the dashboard and marketing authority. Confirm an unapproved host and a duplicate Host receive 400 while the platform-admin and tenant website surfaces cannot claim the probe.
- Use the dedicated HTTP harness and two tenant URLs under one dashboard account. Confirm each request sees its own list and totals. Revoke one membership, make another request and expect a generic 404 for that tenant.
- Try a sibling-tenant website host with a dashboard cookie and a forwarded dashboard Host. The private route must remain unavailable. Confirm an unpublished or unmapped website returns a generic 404.
- Run the isolated Oracle harness and check the exact grants, concurrency, rollback, pool reuse and final cleanup results. Exercise the actual deployed proxy and origin restrictions separately when the deployment work is authorized.
