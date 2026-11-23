# Step 07 SQL implementation inventory

## Current Step 09 SQL inventory - Oracle verified

D-24-approved 000018-000026 is installed on the designated application owner: 26 APPLIED/no repairs/pending versions; 49 tables/569 columns/463 named constraints/101 explicit indexes. The original nine new phases applied cleanly, repeated as a no-op and passed catalog/history/data-count checks after the complete isolated suite passed. The test schema alone retains FAILED 000019 linked to virtual repair 000027; that repair is absent from application artifacts/history. All 26 original entries and 239 SQL-seed byte hashes remain unchanged. No new seed/runtime grant/product service; D-24 excluded values remain unset. [Complete evidence, retained recovery and verification checklist](step09-verification.md). Older draft inventories below are historical.

## D-24 current Step 09 status

All three structural policy recommendations are approved. 000018-000026 remain unapplied; prior 000001-000017 metadata/SQL hashes are preserved. No commercial/theme/feature code, quota, duration, retention, numeric operating configuration, collection or secret replay policy is invented. Retry/scheduling and entitlement enablement require explicit inputs. The manifest retains review for STEP09_ORACLE_COMPATIBILITY and STEP09_TEST_OWNER_PROVISIONING; complete isolated-suite success is an additional application-release gate. [Updated staged operator instructions and verification report](step09-verification.md). Earlier draft approval statements below are historical.

## Historical Step 09 draft before D-24

Nine unapplied phases 000018-000026 add subscription catalog/terms/feature snapshots/invoices/receipts, website theme/settings/media, audit, outbox, jobs and scoped idempotency: 13 tables/175 columns/143 named constraints/34 explicit indexes, 71 SQL files. Total proposed release: 26 phases/49 tables/569 columns/463 constraints/101 explicit indexes. All original 17 migration entries and 168 SQL/seed hashes remain unchanged. Current Oracle installation remains the verified Step 08 baseline (17 APPLIED/36 tables); new SQL is not an executed schema.

Three Step 09 policy questions remain unanswered; manifest review and STEP09_SUBSCRIPTIONS/STEP09_WEBSITE_AUDIT/STEP09_OPERATIONS prevent execution. The separate test owner is not yet provisioned. No new seed/runtime grant/business service. [Exact inventory, blocked Oracle gates and operator commands](step09-verification.md), [scoped ERD](erd-step09.md), [subscription history](subscription-history.md), [website ownership](website-ownership.md), [audit/operations/idempotency](step09-operations.md). Historical Step 07/08 evidence below remains valid only for its own scope.

**Step 07 executed and verified on Oracle; awaiting user verification.** D-18-approved original migrations 000001-000011 applied cleanly to SPORTIFY_SCHEMA_OWNER, repeated with no changes and passed exact catalog verification on 23 November 2026. The application manifest/history has no test repair entries. See [real evidence and retained test recovery](step07-verification.md).

| Version | Name                     | Tables or seed                                                  | Approval/execution             |
| ------- | ------------------------ | --------------------------------------------------------------- | ------------------------------ |
| 000001  | migration_history        | SCHEMA_MIGRATIONS                                               | Applied and verified on Oracle |
| 000002  | reference_catalogs       | SPORTS, PERMISSIONS                                             | Applied and verified on Oracle |
| 000003  | launch_sports            | SPORTS: 8 approved records                                      | Applied and verified on Oracle |
| 000004  | security_roots           | TENANTS, USERS, PLATFORM_ADMINS                                 | Applied and verified on Oracle |
| 000005  | memberships_and_roles    | TENANT_USERS, ROLES, ROLE_PERMISSIONS, USER_ROLES               | Applied and verified on Oracle |
| 000006  | businesses_and_locations | BUSINESSES, BUSINESS_PROFILES, LOCATIONS, BUSINESS_SPORTS       | Applied and verified on Oracle |
| 000007  | sessions_and_tokens      | AUTH_SESSIONS, EMAIL_VERIFICATION_TOKENS, PASSWORD_RESET_TOKENS | Applied and verified on Oracle |
| 000008  | resources                | RESOURCES, RESOURCE_FEATURES                                    | Applied and verified on Oracle |
| 000009  | staff_and_invitations    | STAFF_ASSIGNMENTS, TENANT_INVITATIONS, INVITATION_LOCATIONS     | Applied and verified on Oracle |
| 000010  | schedules_and_pricing    | OPERATING_HOURS, HOLIDAYS, AVAILABILITY_BLOCKS, PRICING_RULES   | Applied and verified on Oracle |
| 000011  | tenant_permissions       | PERMISSIONS: 20 approved records                                | Applied and verified on Oracle |

The release contains 206 named constraints and 30 explicit indexes; PK/UK backing indexes are not duplicated. The initial 000001-000003 SQL bytes were preserved. All 11 versions are now applied and immutable; never edit their SQL or entry metadata. A required tenant-scoped role-name unique key was added consistently to the register/dictionary/index plan and 000005 because the Step 07 prompt explicitly requires it. Only the scoped D-18 structural decisions are approved; unrelated Step 05 policy proposals retain their gates.

## Ownership and security

- Tenant-owned FKs include TENANT_ID and matching candidate keys. Resource location references include business/location identity; optional resource schedules/blocks retain a required location FK. Session active tenant/member fields are both absent or both present, and the FK includes USER_ID.
- USERS email uniqueness applies to its normalized column, with documented all-or-none normalization checks. Roles are tenant-owned; identical display names may exist across tenants, but exact duplicate display names within one tenant are rejected. Content/case/whitespace normalization remains an API-boundary responsibility.
- Authentication tables store encoded password hashes or token digests, never plaintext credentials. Tables do not hash passwords, issue sessions, enforce runtime expiry/authorization, or implement transition history. Invitation acceptance/revocation and token consumption remain authorized application transactions.
- No cascading deletion is introduced. Requiring every tenant to have a business, pricing/schedule overlap resolution, maintenance coordination with future bookings and role default creation remain application workflow invariants.
- Staff assignments are location-scoped in the documented model; future resource access follows the authorized resource/location path. No speculative staff-resource association was invented.
- Runtime object grants remain none: the implemented API/worker still use DUAL only. The operator granted migration-owner-only SYS.DBMS_LOCK EXECUTE; actual owner lock acquisition/release and connection cleanup passed. API/worker grants remain unchanged.

## Approved rules and executed gates

Security structures, 15-minute schedule/duration/buffer rules, overnight segments, holiday activation and all 20 permission codes are approved and represented in the verified schema. Resource duration bounds/buffers remain configurable; no permissions are automatically assigned. Actual booking starts/durations/occupancy and authorization require later application transactions; no booking service/table is added here.

Owner configuration/identity/target/locking, separate restricted test-owner preparation, clean application migration/repeat/catalog and the full disposable integrity/recovery/denial suite passed. Actual catalog: 26 tables, 259 columns, 206 named constraints, 30 explicit indexes, zero invalid objects. References are eight sports/20 permissions; application tenant/user/admin/role-assignment roots remain empty. The initial test verifier failure, strict correction and retained repair are documented in the evidence record. Step 07 is awaiting user verification; Step 08 is not started.

PLATFORM_SETTINGS and ONBOARDING_PROGRESS have no current implemented dependency and remain omitted. Booking/hold/slot/payment/refund/subscription/website/domain/outbox/job/marketplace/recurrence tables remain excluded; no dangling placeholder FKs or broad bootstrap are used.

See [scoped ERD](erd-step07.md), [migration guide](migration-guide.md), [test safety](../../database/tests/README.md) and [reference seed ownership](reference-seeds.md). Static artifact agreement is not Oracle SQL compilation or enforcement.

## Step 08 executed inventory

Application 000012 CUSTOMERS; 000013 BUSINESS_PAYMENT_SETTINGS; 000014 BOOKING_HOLDS/BOOKING_HOLD_ITEMS; 000015 BOOKINGS/BOOKING_ITEMS; 000016 RESOURCE_SLOT_RESERVATIONS/BOOKING_CANCELLATIONS; 000017 PAYMENTS/REFUNDS all applied cleanly, repeated no-op and passed actual Oracle catalog verification after full isolated-suite success. Delta ten tables/135 columns/114 constraints/37 indexes; combined 36 tables/394 columns/320 constraints/67 explicit indexes. All 17 source entries/SQL are now immutable. Existing facilities/schedules and original 11 entries are unchanged; PAYMENT_TRANSACTIONS is excluded.

D-21 policies remain approved; D-22 records comparator and harness corrections plus test-only retained FAILED 000017->APPLIED 000018. Application history has only 17 APPLIED and no repair/pending. The separate used Step 07 test history is preserved. Actual 40 integrity cases, A-E races, cleanup and runtime denials passed. Runtime grants remain unchanged. [Dated complete evidence and limits](step08-verification.md); [scoped diagram](erd-step08.md). No production booking/payment/maintenance service or Step 09. Step 08 awaiting user verification.
