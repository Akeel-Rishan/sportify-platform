# Step 07 implementation inventory

**Partial implementation, awaiting structural decisions and user verification. No Oracle execution.** The reviewed Step 05 dictionary/ERDs still describe the broader proposed MVP, not an installed schema. This overlay identifies exactly which SQL artifacts currently exist; nothing here marks authentication, tenant authorization or facility workflows complete.

| Version                   | Artifact scope                                                                                                         | Implemented in SQL                                                             | Oracle executed/tested |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------- |
| 000001 migration_history  | SCHEMA_MIGRATIONS with 13 dictionary columns, PK, static lifecycle checks, repair self-FK and child index              | Yes, three explicit statement files                                            | BLOCKED / not run      |
| 000002 reference_catalogs | SPORTS and PERMISSIONS with dictionary definitions, positive identity checks, unique natural codes and sports Y/N flag | Yes, two CREATE TABLE files; no duplicate PK/UK indexes                        | BLOCKED / not run      |
| 000003 launch_sports      | Eight launch sport records, insert-only natural-key MERGE                                                              | Yes; transactional seed, no generated-ID constants or updates to existing rows | BLOCKED / not run      |

The manifest's review gate remains closed. Current SQL is not represented as a complete approved Step 07 release. No runtime grants are needed by implemented HTTP/worker behavior; connectivity probes still use DUAL. Permission seeds are pending the explicit catalog choice; no tenant, employee, role assignment or administrator is seeded.

## Required remainder after decisions

- TENANTS, USERS, TENANT_USERS, AUTH_SESSIONS, EMAIL_VERIFICATION_TOKENS, PASSWORD_RESET_TOKENS and PLATFORM_ADMINS: session audience/active-membership ownership, added public UUIDs and token key-version structures remain proposal gates Q-08/Q-09/Q-14.
- ROLES, ROLE_PERMISSIONS, USER_ROLES, STAFF_ASSIGNMENTS, TENANT_INVITATIONS and proposed INVITATION_LOCATIONS: tenant-safe candidate keys/FKs and pending branch assignments require the scoped structural decision Q-17. No global tenant-role templates or sample tenants are planned.
- BUSINESSES, BUSINESS_PROFILES, LOCATIONS, BUSINESS_SPORTS, RESOURCES, RESOURCE_FEATURES, OPERATING_HOURS, HOLIDAYS, AVAILABILITY_BLOCKS and PRICING_RULES: quarter-hour duration/buffer rules, schedule segments/closed-null checks and holiday deactivation require Q-05/Q-06/Q-21 decisions.
- Permission catalog: source 14 tenant codes versus the documented 20-code reconciliation is awaiting an explicit choice (Q-18). No platform permission codes or assignments will be inserted.
- Real tenant-integrity fixtures, controlled migration-failure/repair tests and runtime positive/negative privilege verification remain incomplete. Unit tests do not substitute for them.

PLATFORM_SETTINGS and ONBOARDING_PROGRESS are still designed MVP tables but have no implemented dependency requiring them in this step; they are not included speculatively. Booking/hold/slot/payment/refund/subscription/website/domain/outbox/job/marketplace/recurrence tables are excluded from Step 07. Their FKs are not introduced as unenforced placeholders. The source 61-table bootstrap is preserved and never executed.

When the outstanding decisions arrive, add dependency-ordered immutable entries to this same manifest, verify the accepted dictionary/constraint/index definitions against their SQL and extend real Oracle tests. Do not remove the review gate while the required subset is incomplete. Until then, Step 07's verification gate remains incomplete.
