# Step 07 Oracle verification record

23 November 2026, operator-designated development ATP target, pinned Node 22.22.0 / node-oracledb 26.0.0 Thin mTLS. User approval is D-18. Secrets and wallet material were supplied through protected operator configuration and are excluded from this record. **Step 07 executed and verified on Oracle; awaiting user verification. Step 08 not started.**

| Area               | Executed evidence                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provisioning       | User supplied successful ADMIN narrow owner-lock grant and locked disposable-owner preparation output. Independent actual test login checked identity/target, exact CREATE SESSION/TABLE/SEQUENCE without admin option, no roles/column grants, only DBMS_LOCK EXECUTE, finite 256 MB DATA quota, empty schema and real lock capability. No agent ADMIN credential or account/password reset. |
| Application owner  | All original versions 000001-000011 applied from its previously empty schema. Second invocation returned applied:[]; separate catalog verification passed. Status shows 11 APPLIED, no repair links and no pending migrations.                                                                                                                                                                |
| Exact catalog      | 26 tables / 259 columns / 206 named constraints / 30 explicit indexes verified against manifest, with type/length/default/identity/nullable values, enabled/validated constraints, FK parents/NO ACTION and valid backing/LOB indexes. No invalid objects.                                                                                                                                    |
| References         | Exactly eight sports and 20 permission codes. Actual seed SQL reran twice in rollback-only customization fixtures; IDs, names/labels/flags/descriptions/cardinality preserved. No tenant/user/admin/role-permission assignment rows in the application schema.                                                                                                                                |
| Integrity          | All 33 exact Oracle error/registered-constraint cases passed in the disposable owner, including two-tenant membership/role/staff/invitation/facility/session boundaries, same-tenant wrong-location resource references, duplicate keys, UUIDs, flags/status, optional pairs, schedule/grid/rate rules and protected deletion. All fixture DML rolled back.                                   |
| Locks/checksums    | Actual second owner session was denied while the first held the migration lock across committed CREATE/DROP fixture DDL. Modified applied checksum refused without changing history.                                                                                                                                                                                                          |
| Controlled failure | Actual ORA-00904 left a retained FAILED fixture record; later migration and ordinary retry refused. Explicit partial/full-catalog-verified repair under the same lock recorded its own lifecycle, linked the original and admitted only the later seed.                                                                                                                                       |
| Runtime privileges | Both real API/worker identities/target and positive DUAL access passed before exact ORA-00942/01031 denials. Effective privileges remain CREATE SESSION only, no roles/direct object grants; disposable-owner DDL and migration-history read/write denied. Additional SELECT/non-mutating UPDATE denials against actual application-owner history passed. No runtime grants added.            |
| Runtime regression | Existing real connectivity tool passed both identities, repeated UTC reset, bound/exact-value probes, error release/reuse and pool closure. Built API factory served liveness/readiness 200, then readiness safe 503 after controlled local pool close while liveness remained 200, with no-store/request IDs and cleanup. No remote outage was induced.                                      |
| Local checks       | pnpm check passed formatting, zero-warning lint, strict types, 20 files / 188 unit+HTTP tests and all production builds. Coverage passed configured thresholds: 88.82% statements, 81.85% branches, 86.07% functions, 91.07% lines. Static artifact/design checks passed.                                                                                                                     |

## Initial failure and retained explicit reconciliation

The first disposable invocation exited 1 at 000008 after all resource DDL succeeded: the catalog verifier incorrectly rejected Oracle's internal LOB storage for VARCHAR2(2000 CHAR), DATA_LENGTH=8000 on AL32UTF8. [Oracle documents extended data type LOB storage](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Data-Types.html). The verifier was corrected with positive/negative regression tests, while all original SQL/checksums stayed unchanged. It still rejects unexpected columns/LOBs/indexes.

The explicit one-shot disposable reconciliation requires exact first-run history/checksums and a full catalog match before marker creation. It retained FAILED 000008 linked to distinct checksummed APPLIED test-only 000012; 000009-000011 then ran normally. The resumed complete suite exited 0. The later deliberate failure is 000013 linked to repair 000015, with seed 000014 APPLIED. A separate final full test catalog/history audit passed: 15 rows, 13 APPLIED, two retained repaired FAILED records and no RUNNING rows. No failure was deleted or relabeled APPLIED. No owner was cleared/recreated. See [recovery safety](../../database/tests/README.md#explicit-first-run-extended-string-reconciliation).

The application release contains none of these test-only entries: its original 11 versions subsequently applied cleanly and independently verified. Thus the initial test failure is not mislabeled a passing clean run, and the application clean run is separate evidence.

## Reproducible operator commands

Build public compiled packages, then use separately protected operator files or equivalent process-scoped secret injection. Existing process environment takes precedence; never attach owner environment to API/worker startup.

```sh
pnpm build:packages
node --env-file="<protected-owner-env-file>" infra/scripts/database-status.mjs
node --env-file="<protected-owner-env-file>" infra/scripts/database-migrate.mjs
node --env-file="<protected-owner-env-file>" infra/scripts/database-verify.mjs
# Default full suite only against a separately prepared genuinely empty disposable owner:
node --env-file="<protected-test-owner-env-file>" database/tests/oracle-migration-runner.mjs
```

Use npx --yes pnpm@10.34.9 if pnpm is unavailable. The already-used SPORTIFY_TEST_OWNER retains installed fixtures/history and is intentionally not eligible for another clean invocation or the one-shot reconciliation. Do not clear/recreate it automatically or rerun initial provisioning/postconditions on installed schemas.

## Scope and remaining limits

Authentication/cookies/authorization guards, tenant onboarding, pricing/availability/booking workflows and later tables are not implemented. Connectivity readiness remains application-and-Oracle only, not schema/commercial readiness. Future object grants require actual implemented duties. No claim of OCI ARM64/container/POSIX execution, external outage/recovery, full ADMIN PUBLIC baseline approval or database-helper transaction persistence under runtime fixture grants is added here. Existing runtime password separation recommendation remains outstanding; no silent rotation occurred. No product UI, commit, push, deployment, network change or Step 08 work.

User verification: inspect original application history/catalog with protected status/verify commands, confirm eight sports/20 permissions and empty business roots through an authorized owner tool, and smoke-test API health/readiness plus the idle worker. Preserve all installed/reference/test history and immutable migration files.
