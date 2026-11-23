# Relationships and constraints

**Proposed target, not executed DDL.** Source definitions are retained unless the row is marked proposed. Names/columns below are exact for the review design; the dictionary links here rather than duplicating definitions. Each FK targets the listed exact PK/UK order. No FK has ON DELETE CASCADE. All constraints are intended ENABLE VALIDATE, nondeferrable/immediate unless a later reviewed migration explicitly changes them.

## Isolation rules

Tenant-owned rows require non-null TENANT_ID. A FK to global USERS, SPORTS, PERMISSIONS, a plan or a global administrator does not contain a tenant key because those parents are global; tenant membership/authorization must still be checked. A direct TENANT_ID-to-TENANTS FK or a mandatory tenant-aware parent path anchors every tenant row. Nullable optional IDs use an independently required tenant anchor; all-or-none checks prevent partially-null required relationships. Composite FKs do not authorize reads.

Mixed platform/tenant operations use explicit scope checks. NOTIFICATIONS and NOTIFICATION_LOGS additionally use a non-null SCOPE_TENANT_ID (0 for platform, actual positive tenant ID otherwise) and a composite scope FK. Their normal tenant FK is retained, while the non-null scope FK prevents a NULL tenant from borrowing another tenant notification. Global templates cannot contain tenant rows in MVP, so their single-ID FK cannot cross tenant templates. Identity TENANTS IDs must be positive; zero is reserved solely for scope normalization.

A booking/item/resource FK proves membership/resource equality; interval containment, status, currency totals, authorization, parent/item cardinalities and maintenance overlap still require transactions. Exactly one booking item and one hold item per header is the proposed MVP service invariant; schema multiplicity supports later extension without enabling it.

Oracle composite UNIQUE semantics already reject equal non-null components in partially null keys; do not assume PostgreSQL null uniqueness. The proposed schedule key adds SEGMENT_NO for explicit overnight/multiple segments, not to repair nonexistent null uniqueness. Nullable FK semantics differ: any null FK component can bypass the relationship, hence the explicit scope/pair checks. See [Oracle evidence](README.md#oracle-compatibility-and-evidence).

## Exact key and FK register

| Table                            | Name                                  | Kind | Child/key columns                                              | Referenced table         | Referenced columns                                  | Origin   |
| -------------------------------- | ------------------------------------- | ---- | -------------------------------------------------------------- | ------------------------ | --------------------------------------------------- | -------- |
| `SCHEMA_MIGRATIONS`              | `PK_SCHEMA_MIGRATIONS`                | PK   | `VERSION`                                                      | `-`                      | `-`                                                 | source   |
| `SCHEMA_MIGRATIONS`              | `FK_MIGRATION_REPAIR`                 | FK   | `REPAIR_VERSION`                                               | `SCHEMA_MIGRATIONS`      | `VERSION`                                           | proposed |
| `TENANTS`                        | `PK_TENANTS`                          | PK   | `TENANT_ID`                                                    | `-`                      | `-`                                                 | source   |
| `TENANTS`                        | `UQ_TENANTS_PUBLIC_ID`                | UK   | `PUBLIC_ID`                                                    | `-`                      | `-`                                                 | source   |
| `TENANTS`                        | `UQ_TENANTS_CODE`                     | UK   | `TENANT_CODE`                                                  | `-`                      | `-`                                                 | source   |
| `USERS`                          | `PK_USERS`                            | PK   | `USER_ID`                                                      | `-`                      | `-`                                                 | source   |
| `USERS`                          | `UQ_USERS_PUBLIC_ID`                  | UK   | `PUBLIC_ID`                                                    | `-`                      | `-`                                                 | source   |
| `USERS`                          | `UQ_USERS_EMAIL_NORMALIZED`           | UK   | `EMAIL_NORMALIZED`                                             | `-`                      | `-`                                                 | source   |
| `PLATFORM_SETTINGS`              | `PK_PLATFORM_SETTINGS`                | PK   | `SETTING_KEY`                                                  | `-`                      | `-`                                                 | source   |
| `TENANT_USERS`                   | `PK_TENANT_USERS`                     | PK   | `MEMBERSHIP_ID`                                                | `-`                      | `-`                                                 | source   |
| `TENANT_USERS`                   | `UQ_TU_TENANT_MEMBER`                 | UK   | `TENANT_ID, MEMBERSHIP_ID`                                     | `-`                      | `-`                                                 | source   |
| `TENANT_USERS`                   | `UQ_TU_TENANT_MEMBER_USER`            | UK   | `TENANT_ID, MEMBERSHIP_ID, USER_ID`                            | `-`                      | `-`                                                 | source   |
| `TENANT_USERS`                   | `UQ_TENANT_USERS_TENANT_USER`         | UK   | `TENANT_ID, USER_ID`                                           | `-`                      | `-`                                                 | source   |
| `TENANT_USERS`                   | `FK_TENANT_USERS_TENANT`              | FK   | `TENANT_ID`                                                    | `TENANTS`                | `TENANT_ID`                                         | source   |
| `TENANT_USERS`                   | `FK_TENANT_USERS_USER`                | FK   | `USER_ID`                                                      | `USERS`                  | `USER_ID`                                           | source   |
| `TENANT_USERS`                   | `FK_TENANT_USERS_INVITER`             | FK   | `TENANT_ID, INVITED_BY_MEMBERSHIP_ID`                          | `TENANT_USERS`           | `TENANT_ID, MEMBERSHIP_ID`                          | source   |
| `TENANT_USERS`                   | `UQ_TENANT_USERS_PUBLIC_ID`           | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `AUTH_SESSIONS`                  | `PK_AUTH_SESSIONS`                    | PK   | `SESSION_ID`                                                   | `-`                      | `-`                                                 | source   |
| `AUTH_SESSIONS`                  | `UQ_AUTH_SESSIONS_TOKEN`              | UK   | `TOKEN_HASH`                                                   | `-`                      | `-`                                                 | source   |
| `AUTH_SESSIONS`                  | `FK_AUTH_SESSIONS_USER`               | FK   | `USER_ID`                                                      | `USERS`                  | `USER_ID`                                           | source   |
| `AUTH_SESSIONS`                  | `FK_SESSION_ACTIVE_MEMBER`            | FK   | `ACTIVE_TENANT_ID, ACTIVE_MEMBERSHIP_ID, USER_ID`              | `TENANT_USERS`           | `TENANT_ID, MEMBERSHIP_ID, USER_ID`                 | proposed |
| `EMAIL_VERIFICATION_TOKENS`      | `PK_EMAIL_VERIFICATION_TOKENS`        | PK   | `VERIFICATION_ID`                                              | `-`                      | `-`                                                 | source   |
| `EMAIL_VERIFICATION_TOKENS`      | `UQ_EMAIL_VERIFICATION_TOKEN`         | UK   | `TOKEN_HASH`                                                   | `-`                      | `-`                                                 | source   |
| `EMAIL_VERIFICATION_TOKENS`      | `FK_EMAIL_VERIFICATION_USER`          | FK   | `USER_ID`                                                      | `USERS`                  | `USER_ID`                                           | source   |
| `EMAIL_VERIFICATION_TOKENS`      | `UQ_EMAIL_VERIFICATION_TOKENS_PUBLIC` | UK   | `PUBLIC_ID`                                                    | `-`                      | `-`                                                 | proposed |
| `PASSWORD_RESET_TOKENS`          | `PK_PASSWORD_RESET_TOKENS`            | PK   | `RESET_ID`                                                     | `-`                      | `-`                                                 | source   |
| `PASSWORD_RESET_TOKENS`          | `UQ_PASSWORD_RESET_TOKEN`             | UK   | `TOKEN_HASH`                                                   | `-`                      | `-`                                                 | source   |
| `PASSWORD_RESET_TOKENS`          | `FK_PASSWORD_RESET_USER`              | FK   | `USER_ID`                                                      | `USERS`                  | `USER_ID`                                           | source   |
| `PASSWORD_RESET_TOKENS`          | `UQ_PASSWORD_RESET_TOKENS_PUBLIC`     | UK   | `PUBLIC_ID`                                                    | `-`                      | `-`                                                 | proposed |
| `PLATFORM_ADMINS`                | `PK_PLATFORM_ADMINS`                  | PK   | `PLATFORM_ADMIN_ID`                                            | `-`                      | `-`                                                 | source   |
| `PLATFORM_ADMINS`                | `UQ_PLATFORM_ADMINS_USER`             | UK   | `USER_ID`                                                      | `-`                      | `-`                                                 | source   |
| `PLATFORM_ADMINS`                | `FK_PLATFORM_ADMINS_USER`             | FK   | `USER_ID`                                                      | `USERS`                  | `USER_ID`                                           | source   |
| `PLATFORM_ADMINS`                | `UQ_ADMIN_USER_PAIR`                  | UK   | `PLATFORM_ADMIN_ID, USER_ID`                                   | `-`                      | `-`                                                 | proposed |
| `ROLES`                          | `PK_ROLES`                            | PK   | `ROLE_ID`                                                      | `-`                      | `-`                                                 | source   |
| `ROLES`                          | `UQ_ROLES_TENANT_ROLE`                | UK   | `TENANT_ID, ROLE_ID`                                           | `-`                      | `-`                                                 | source   |
| `ROLES`                          | `UQ_ROLES_TENANT_CODE`                | UK   | `TENANT_ID, ROLE_CODE`                                         | `-`                      | `-`                                                 | source   |
| `ROLES`                          | `UQ_ROLES_TENANT_NAME`                | UK   | `TENANT_ID, ROLE_NAME`                                         | `-`                      | `-`                                                 | required |
| `ROLES`                          | `FK_ROLES_TENANT`                     | FK   | `TENANT_ID`                                                    | `TENANTS`                | `TENANT_ID`                                         | source   |
| `PERMISSIONS`                    | `PK_PERMISSIONS`                      | PK   | `PERMISSION_ID`                                                | `-`                      | `-`                                                 | source   |
| `PERMISSIONS`                    | `UQ_PERMISSIONS_CODE`                 | UK   | `PERMISSION_CODE`                                              | `-`                      | `-`                                                 | source   |
| `ROLE_PERMISSIONS`               | `PK_ROLE_PERMISSIONS`                 | PK   | `TENANT_ID, ROLE_ID, PERMISSION_ID`                            | `-`                      | `-`                                                 | source   |
| `ROLE_PERMISSIONS`               | `FK_ROLE_PERMISSIONS_ROLE`            | FK   | `TENANT_ID, ROLE_ID`                                           | `ROLES`                  | `TENANT_ID, ROLE_ID`                                | source   |
| `ROLE_PERMISSIONS`               | `FK_ROLE_PERMISSIONS_PERMISSION`      | FK   | `PERMISSION_ID`                                                | `PERMISSIONS`            | `PERMISSION_ID`                                     | source   |
| `USER_ROLES`                     | `PK_USER_ROLES`                       | PK   | `TENANT_ID, MEMBERSHIP_ID, ROLE_ID`                            | `-`                      | `-`                                                 | source   |
| `USER_ROLES`                     | `FK_USER_ROLES_MEMBERSHIP`            | FK   | `TENANT_ID, MEMBERSHIP_ID`                                     | `TENANT_USERS`           | `TENANT_ID, MEMBERSHIP_ID`                          | source   |
| `USER_ROLES`                     | `FK_USER_ROLES_ROLE`                  | FK   | `TENANT_ID, ROLE_ID`                                           | `ROLES`                  | `TENANT_ID, ROLE_ID`                                | source   |
| `USER_ROLES`                     | `FK_USER_ROLES_ASSIGNER`              | FK   | `TENANT_ID, ASSIGNED_BY_MEMBERSHIP_ID`                         | `TENANT_USERS`           | `TENANT_ID, MEMBERSHIP_ID`                          | source   |
| `TENANT_INVITATIONS`             | `PK_TENANT_INVITATIONS`               | PK   | `INVITATION_ID`                                                | `-`                      | `-`                                                 | source   |
| `TENANT_INVITATIONS`             | `UQ_TENANT_INVITATIONS_TOKEN`         | UK   | `TOKEN_HASH`                                                   | `-`                      | `-`                                                 | source   |
| `TENANT_INVITATIONS`             | `UQ_INV_TENANT_ID`                    | UK   | `TENANT_ID, INVITATION_ID`                                     | `-`                      | `-`                                                 | source   |
| `TENANT_INVITATIONS`             | `FK_TENANT_INVITATIONS_TENANT`        | FK   | `TENANT_ID`                                                    | `TENANTS`                | `TENANT_ID`                                         | source   |
| `TENANT_INVITATIONS`             | `FK_TENANT_INVITATIONS_ROLE`          | FK   | `TENANT_ID, ROLE_ID`                                           | `ROLES`                  | `TENANT_ID, ROLE_ID`                                | source   |
| `TENANT_INVITATIONS`             | `FK_TENANT_INVITATIONS_INVITER`       | FK   | `TENANT_ID, INVITED_BY_MEMBERSHIP_ID`                          | `TENANT_USERS`           | `TENANT_ID, MEMBERSHIP_ID`                          | source   |
| `TENANT_INVITATIONS`             | `UQ_TENANT_INVITATIONS_PUBLIC_ID`     | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `BUSINESSES`                     | `PK_BUSINESSES`                       | PK   | `BUSINESS_ID`                                                  | `-`                      | `-`                                                 | source   |
| `BUSINESSES`                     | `UQ_BUSINESSES_TENANT_ID`             | UK   | `TENANT_ID, BUSINESS_ID`                                       | `-`                      | `-`                                                 | source   |
| `BUSINESSES`                     | `UQ_BUSINESSES_ONE_PER_TENANT`        | UK   | `TENANT_ID`                                                    | `-`                      | `-`                                                 | source   |
| `BUSINESSES`                     | `UQ_BUSINESSES_SLUG`                  | UK   | `BUSINESS_SLUG`                                                | `-`                      | `-`                                                 | source   |
| `BUSINESSES`                     | `FK_BUSINESSES_TENANT`                | FK   | `TENANT_ID`                                                    | `TENANTS`                | `TENANT_ID`                                         | source   |
| `BUSINESSES`                     | `UQ_BUSINESSES_PUBLIC_ID`             | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `BUSINESS_PROFILES`              | `PK_BUSINESS_PROFILES`                | PK   | `BUSINESS_PROFILE_ID`                                          | `-`                      | `-`                                                 | source   |
| `BUSINESS_PROFILES`              | `UQ_BUSINESS_PROFILES_BUSINESS`       | UK   | `TENANT_ID, BUSINESS_ID`                                       | `-`                      | `-`                                                 | source   |
| `BUSINESS_PROFILES`              | `FK_BUSINESS_PROFILES_BUSINESS`       | FK   | `TENANT_ID, BUSINESS_ID`                                       | `BUSINESSES`             | `TENANT_ID, BUSINESS_ID`                            | source   |
| `LOCATIONS`                      | `PK_LOCATIONS`                        | PK   | `LOCATION_ID`                                                  | `-`                      | `-`                                                 | source   |
| `LOCATIONS`                      | `UQ_LOCATIONS_TENANT_ID`              | UK   | `TENANT_ID, LOCATION_ID`                                       | `-`                      | `-`                                                 | source   |
| `LOCATIONS`                      | `UQ_LOCATIONS_BUSINESS_LOCATION`      | UK   | `TENANT_ID, BUSINESS_ID, LOCATION_ID`                          | `-`                      | `-`                                                 | source   |
| `LOCATIONS`                      | `UQ_LOCATIONS_BUSINESS_CODE`          | UK   | `TENANT_ID, BUSINESS_ID, LOCATION_CODE`                        | `-`                      | `-`                                                 | source   |
| `LOCATIONS`                      | `FK_LOCATIONS_BUSINESS`               | FK   | `TENANT_ID, BUSINESS_ID`                                       | `BUSINESSES`             | `TENANT_ID, BUSINESS_ID`                            | source   |
| `LOCATIONS`                      | `UQ_LOCATIONS_PUBLIC_ID`              | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `STAFF_ASSIGNMENTS`              | `PK_STAFF_ASSIGNMENTS`                | PK   | `STAFF_ASSIGNMENT_ID`                                          | `-`                      | `-`                                                 | source   |
| `STAFF_ASSIGNMENTS`              | `UQ_STAFF_ASSIGNMENTS_TENANT_ID`      | UK   | `TENANT_ID, STAFF_ASSIGNMENT_ID`                               | `-`                      | `-`                                                 | source   |
| `STAFF_ASSIGNMENTS`              | `UQ_STAFF_MEMBER_LOC`                 | UK   | `TENANT_ID, MEMBERSHIP_ID, LOCATION_ID`                        | `-`                      | `-`                                                 | source   |
| `STAFF_ASSIGNMENTS`              | `FK_STAFF_MEMBER`                     | FK   | `TENANT_ID, MEMBERSHIP_ID`                                     | `TENANT_USERS`           | `TENANT_ID, MEMBERSHIP_ID`                          | source   |
| `STAFF_ASSIGNMENTS`              | `FK_STAFF_ASSIGNMENTS_LOCATION`       | FK   | `TENANT_ID, LOCATION_ID`                                       | `LOCATIONS`              | `TENANT_ID, LOCATION_ID`                            | source   |
| `STAFF_ASSIGNMENTS`              | `UQ_STAFF_ASSIGNMENTS_PUBLIC_ID`      | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `SPORTS`                         | `PK_SPORTS`                           | PK   | `SPORT_ID`                                                     | `-`                      | `-`                                                 | source   |
| `SPORTS`                         | `UQ_SPORTS_CODE`                      | UK   | `SPORT_CODE`                                                   | `-`                      | `-`                                                 | source   |
| `BUSINESS_SPORTS`                | `PK_BUSINESS_SPORTS`                  | PK   | `TENANT_ID, BUSINESS_ID, SPORT_ID`                             | `-`                      | `-`                                                 | source   |
| `BUSINESS_SPORTS`                | `FK_BUSINESS_SPORTS_BUSINESS`         | FK   | `TENANT_ID, BUSINESS_ID`                                       | `BUSINESSES`             | `TENANT_ID, BUSINESS_ID`                            | source   |
| `BUSINESS_SPORTS`                | `FK_BUSINESS_SPORTS_SPORT`            | FK   | `SPORT_ID`                                                     | `SPORTS`                 | `SPORT_ID`                                          | source   |
| `RESOURCES`                      | `PK_RESOURCES`                        | PK   | `RESOURCE_ID`                                                  | `-`                      | `-`                                                 | source   |
| `RESOURCES`                      | `UQ_RESOURCES_TENANT_ID`              | UK   | `TENANT_ID, RESOURCE_ID`                                       | `-`                      | `-`                                                 | source   |
| `RESOURCES`                      | `UQ_RES_TENANT_LOC_ID`                | UK   | `TENANT_ID, LOCATION_ID, RESOURCE_ID`                          | `-`                      | `-`                                                 | source   |
| `RESOURCES`                      | `UQ_RES_BIZ_LOC_ID`                   | UK   | `TENANT_ID, BUSINESS_ID, LOCATION_ID, RESOURCE_ID`             | `-`                      | `-`                                                 | source   |
| `RESOURCES`                      | `UQ_RESOURCES_LOCATION_CODE`          | UK   | `TENANT_ID, LOCATION_ID, RESOURCE_CODE`                        | `-`                      | `-`                                                 | source   |
| `RESOURCES`                      | `FK_RESOURCES_BUSINESS`               | FK   | `TENANT_ID, BUSINESS_ID`                                       | `BUSINESSES`             | `TENANT_ID, BUSINESS_ID`                            | source   |
| `RESOURCES`                      | `FK_RESOURCES_LOCATION`               | FK   | `TENANT_ID, BUSINESS_ID, LOCATION_ID`                          | `LOCATIONS`              | `TENANT_ID, BUSINESS_ID, LOCATION_ID`               | source   |
| `RESOURCES`                      | `FK_RESOURCES_BUSINESS_SPORT`         | FK   | `TENANT_ID, BUSINESS_ID, SPORT_ID`                             | `BUSINESS_SPORTS`        | `TENANT_ID, BUSINESS_ID, SPORT_ID`                  | source   |
| `RESOURCES`                      | `UQ_RESOURCES_PUBLIC_ID`              | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `RESOURCE_FEATURES`              | `PK_RESOURCE_FEATURES`                | PK   | `RESOURCE_FEATURE_ID`                                          | `-`                      | `-`                                                 | source   |
| `RESOURCE_FEATURES`              | `UQ_RESOURCE_FEATURES_TENANT_ID`      | UK   | `TENANT_ID, RESOURCE_FEATURE_ID`                               | `-`                      | `-`                                                 | source   |
| `RESOURCE_FEATURES`              | `UQ_RESOURCE_FEATURES_CODE`           | UK   | `TENANT_ID, RESOURCE_ID, FEATURE_CODE`                         | `-`                      | `-`                                                 | source   |
| `RESOURCE_FEATURES`              | `FK_RESOURCE_FEATURES_RESOURCE`       | FK   | `TENANT_ID, RESOURCE_ID`                                       | `RESOURCES`              | `TENANT_ID, RESOURCE_ID`                            | source   |
| `OPERATING_HOURS`                | `PK_OPERATING_HOURS`                  | PK   | `OPERATING_HOUR_ID`                                            | `-`                      | `-`                                                 | source   |
| `OPERATING_HOURS`                | `UQ_OPERATING_HOURS_TENANT_ID`        | UK   | `TENANT_ID, OPERATING_HOUR_ID`                                 | `-`                      | `-`                                                 | source   |
| `OPERATING_HOURS`                | `FK_OPERATING_HOURS_LOCATION`         | FK   | `TENANT_ID, LOCATION_ID`                                       | `LOCATIONS`              | `TENANT_ID, LOCATION_ID`                            | source   |
| `OPERATING_HOURS`                | `FK_OPERATING_HOURS_RESOURCE`         | FK   | `TENANT_ID, LOCATION_ID, RESOURCE_ID`                          | `RESOURCES`              | `TENANT_ID, LOCATION_ID, RESOURCE_ID`               | source   |
| `OPERATING_HOURS`                | `UQ_OPERATING_HOURS_PUBLIC_ID`        | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `OPERATING_HOURS`                | `UQ_OPERATING_HOURS_SEGMENT`          | UK   | `TENANT_ID, LOCATION_ID, RESOURCE_ID, DAY_OF_WEEK, SEGMENT_NO` | `-`                      | `-`                                                 | proposed |
| `HOLIDAYS`                       | `PK_HOLIDAYS`                         | PK   | `HOLIDAY_ID`                                                   | `-`                      | `-`                                                 | source   |
| `HOLIDAYS`                       | `UQ_HOLIDAYS_TENANT_ID`               | UK   | `TENANT_ID, HOLIDAY_ID`                                        | `-`                      | `-`                                                 | source   |
| `HOLIDAYS`                       | `UQ_HOLIDAYS_LOCATION_DATE`           | UK   | `TENANT_ID, LOCATION_ID, HOLIDAY_DATE`                         | `-`                      | `-`                                                 | source   |
| `HOLIDAYS`                       | `FK_HOLIDAYS_LOCATION`                | FK   | `TENANT_ID, LOCATION_ID`                                       | `LOCATIONS`              | `TENANT_ID, LOCATION_ID`                            | source   |
| `HOLIDAYS`                       | `UQ_HOLIDAYS_PUBLIC_ID`               | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `AVAILABILITY_BLOCKS`            | `PK_AVAILABILITY_BLOCKS`              | PK   | `AVAILABILITY_BLOCK_ID`                                        | `-`                      | `-`                                                 | source   |
| `AVAILABILITY_BLOCKS`            | `UQ_AVAIL_BLK_TENANT_ID`              | UK   | `TENANT_ID, AVAILABILITY_BLOCK_ID`                             | `-`                      | `-`                                                 | source   |
| `AVAILABILITY_BLOCKS`            | `FK_AVAIL_LOC`                        | FK   | `TENANT_ID, LOCATION_ID`                                       | `LOCATIONS`              | `TENANT_ID, LOCATION_ID`                            | source   |
| `AVAILABILITY_BLOCKS`            | `FK_AVAIL_RESOURCE`                   | FK   | `TENANT_ID, LOCATION_ID, RESOURCE_ID`                          | `RESOURCES`              | `TENANT_ID, LOCATION_ID, RESOURCE_ID`               | source   |
| `AVAILABILITY_BLOCKS`            | `FK_AVAILABILITY_BLOCKS_CREATOR`      | FK   | `TENANT_ID, CREATED_BY_MEMBERSHIP_ID`                          | `TENANT_USERS`           | `TENANT_ID, MEMBERSHIP_ID`                          | source   |
| `AVAILABILITY_BLOCKS`            | `UQ_AVAILABILITY_BLOCKS_PUBLIC_ID`    | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `PRICING_RULES`                  | `PK_PRICING_RULES`                    | PK   | `PRICING_RULE_ID`                                              | `-`                      | `-`                                                 | source   |
| `PRICING_RULES`                  | `UQ_PRICING_RULES_TENANT_ID`          | UK   | `TENANT_ID, PRICING_RULE_ID`                                   | `-`                      | `-`                                                 | source   |
| `PRICING_RULES`                  | `UQ_PRICING_RULES_CODE`               | UK   | `TENANT_ID, RESOURCE_ID, RULE_CODE`                            | `-`                      | `-`                                                 | source   |
| `PRICING_RULES`                  | `FK_PRICING_RULES_RESOURCE`           | FK   | `TENANT_ID, RESOURCE_ID`                                       | `RESOURCES`              | `TENANT_ID, RESOURCE_ID`                            | source   |
| `PRICING_RULES`                  | `UQ_PRICING_RULES_PUBLIC_ID`          | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `PRICING_RULES`                  | `UQ_PRICE_RESOURCE_KEY`               | UK   | `TENANT_ID, RESOURCE_ID, PRICING_RULE_ID`                      | `-`                      | `-`                                                 | proposed |
| `CUSTOMERS`                      | `PK_CUSTOMERS`                        | PK   | `CUSTOMER_ID`                                                  | `-`                      | `-`                                                 | source   |
| `CUSTOMERS`                      | `UQ_CUSTOMERS_TENANT_ID`              | UK   | `TENANT_ID, CUSTOMER_ID`                                       | `-`                      | `-`                                                 | source   |
| `CUSTOMERS`                      | `UQ_CUSTOMERS_PUBLIC`                 | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | source   |
| `CUSTOMERS`                      | `FK_CUSTOMERS_TENANT`                 | FK   | `TENANT_ID`                                                    | `TENANTS`                | `TENANT_ID`                                         | source   |
| `CUSTOMERS`                      | `FK_CUSTOMERS_USER`                   | FK   | `USER_ID`                                                      | `USERS`                  | `USER_ID`                                           | source   |
| `BOOKING_HOLDS`                  | `PK_BOOKING_HOLDS`                    | PK   | `HOLD_ID`                                                      | `-`                      | `-`                                                 | source   |
| `BOOKING_HOLDS`                  | `UQ_BOOKING_HOLDS_TENANT_ID`          | UK   | `TENANT_ID, HOLD_ID`                                           | `-`                      | `-`                                                 | source   |
| `BOOKING_HOLDS`                  | `UQ_BOOKING_HOLDS_PUBLIC`             | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | source   |
| `BOOKING_HOLDS`                  | `UQ_BOOKING_HOLDS_TOKEN`              | UK   | `HOLD_TOKEN_HASH`                                              | `-`                      | `-`                                                 | source   |
| `BOOKING_HOLDS`                  | `FK_BOOKING_HOLDS_TENANT`             | FK   | `TENANT_ID`                                                    | `TENANTS`                | `TENANT_ID`                                         | source   |
| `BOOKING_HOLD_ITEMS`             | `PK_BOOKING_HOLD_ITEMS`               | PK   | `HOLD_ITEM_ID`                                                 | `-`                      | `-`                                                 | source   |
| `BOOKING_HOLD_ITEMS`             | `UQ_BHI_TENANT_ID`                    | UK   | `TENANT_ID, HOLD_ITEM_ID`                                      | `-`                      | `-`                                                 | source   |
| `BOOKING_HOLD_ITEMS`             | `UQ_BHI_RESOURCE`                     | UK   | `TENANT_ID, HOLD_ITEM_ID, RESOURCE_ID`                         | `-`                      | `-`                                                 | source   |
| `BOOKING_HOLD_ITEMS`             | `FK_BOOKING_HOLD_ITEMS_HOLD`          | FK   | `TENANT_ID, HOLD_ID`                                           | `BOOKING_HOLDS`          | `TENANT_ID, HOLD_ID`                                | source   |
| `BOOKING_HOLD_ITEMS`             | `FK_BOOKING_HOLD_ITEMS_RESOURCE`      | FK   | `TENANT_ID, BUSINESS_ID, LOCATION_ID, RESOURCE_ID`             | `RESOURCES`              | `TENANT_ID, BUSINESS_ID, LOCATION_ID, RESOURCE_ID`  | source   |
| `BOOKING_HOLD_ITEMS`             | `FK_BOOKING_HOLD_ITEMS_PRICE`         | FK   | `TENANT_ID, RESOURCE_ID, PRICING_RULE_ID`                      | `PRICING_RULES`          | `TENANT_ID, RESOURCE_ID, PRICING_RULE_ID`           | proposed |
| `BOOKINGS`                       | `PK_BOOKINGS`                         | PK   | `BOOKING_ID`                                                   | `-`                      | `-`                                                 | source   |
| `BOOKINGS`                       | `UQ_BOOKINGS_TENANT_ID`               | UK   | `TENANT_ID, BOOKING_ID`                                        | `-`                      | `-`                                                 | source   |
| `BOOKINGS`                       | `UQ_BOOKINGS_REFERENCE`               | UK   | `TENANT_ID, BOOKING_REFERENCE`                                 | `-`                      | `-`                                                 | source   |
| `BOOKINGS`                       | `UQ_BOOKINGS_BUSINESS_KEY`            | UK   | `TENANT_ID, BOOKING_ID, BUSINESS_ID`                           | `-`                      | `-`                                                 | source   |
| `BOOKINGS`                       | `UQ_BOOKINGS_CUSTOMER_KEY`            | UK   | `TENANT_ID, BOOKING_ID, CUSTOMER_ID`                           | `-`                      | `-`                                                 | source   |
| `BOOKINGS`                       | `UQ_BOOKINGS_PUBLIC`                  | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | source   |
| `BOOKINGS`                       | `FK_BOOKINGS_BUSINESS`                | FK   | `TENANT_ID, BUSINESS_ID`                                       | `BUSINESSES`             | `TENANT_ID, BUSINESS_ID`                            | source   |
| `BOOKINGS`                       | `FK_BOOKINGS_CUSTOMER`                | FK   | `TENANT_ID, CUSTOMER_ID`                                       | `CUSTOMERS`              | `TENANT_ID, CUSTOMER_ID`                            | source   |
| `BOOKINGS`                       | `FK_BOOKINGS_HOLD`                    | FK   | `TENANT_ID, SOURCE_HOLD_ID`                                    | `BOOKING_HOLDS`          | `TENANT_ID, HOLD_ID`                                | source   |
| `BOOKINGS`                       | `FK_BOOKINGS_CREATOR`                 | FK   | `TENANT_ID, CREATED_BY_MEMBERSHIP_ID`                          | `TENANT_USERS`           | `TENANT_ID, MEMBERSHIP_ID`                          | source   |
| `BOOKINGS`                       | `UQ_BOOKING_CURRENCY`                 | UK   | `TENANT_ID, BOOKING_ID, CURRENCY_CODE`                         | `-`                      | `-`                                                 | proposed |
| `BOOKING_ITEMS`                  | `PK_BOOKING_ITEMS`                    | PK   | `BOOKING_ITEM_ID`                                              | `-`                      | `-`                                                 | source   |
| `BOOKING_ITEMS`                  | `UQ_BOOKING_ITEMS_TENANT_ID`          | UK   | `TENANT_ID, BOOKING_ITEM_ID`                                   | `-`                      | `-`                                                 | source   |
| `BOOKING_ITEMS`                  | `UQ_BI_RESOURCE`                      | UK   | `TENANT_ID, BOOKING_ITEM_ID, RESOURCE_ID`                      | `-`                      | `-`                                                 | source   |
| `BOOKING_ITEMS`                  | `FK_BOOKING_ITEMS_BOOKING`            | FK   | `TENANT_ID, BOOKING_ID, BUSINESS_ID`                           | `BOOKINGS`               | `TENANT_ID, BOOKING_ID, BUSINESS_ID`                | source   |
| `BOOKING_ITEMS`                  | `FK_BOOKING_ITEMS_RESOURCE`           | FK   | `TENANT_ID, BUSINESS_ID, LOCATION_ID, RESOURCE_ID`             | `RESOURCES`              | `TENANT_ID, BUSINESS_ID, LOCATION_ID, RESOURCE_ID`  | source   |
| `BOOKING_ITEMS`                  | `FK_BOOKING_ITEMS_PRICE`              | FK   | `TENANT_ID, RESOURCE_ID, PRICING_RULE_ID`                      | `PRICING_RULES`          | `TENANT_ID, RESOURCE_ID, PRICING_RULE_ID`           | proposed |
| `BOOKING_ITEMS`                  | `FK_BI_CURRENCY`                      | FK   | `TENANT_ID, BOOKING_ID, CURRENCY_CODE`                         | `BOOKINGS`               | `TENANT_ID, BOOKING_ID, CURRENCY_CODE`              | proposed |
| `RESOURCE_SLOT_RESERVATIONS`     | `PK_RESOURCE_SLOT_RESERVATIONS`       | PK   | `TENANT_ID, RESOURCE_ID, SLOT_START_UTC`                       | `-`                      | `-`                                                 | source   |
| `RESOURCE_SLOT_RESERVATIONS`     | `FK_SLOT_RESERVATIONS_RESOURCE`       | FK   | `TENANT_ID, RESOURCE_ID`                                       | `RESOURCES`              | `TENANT_ID, RESOURCE_ID`                            | source   |
| `RESOURCE_SLOT_RESERVATIONS`     | `FK_SLOTS_BOOKING_ITEM`               | FK   | `TENANT_ID, BOOKING_ITEM_ID, RESOURCE_ID`                      | `BOOKING_ITEMS`          | `TENANT_ID, BOOKING_ITEM_ID, RESOURCE_ID`           | source   |
| `RESOURCE_SLOT_RESERVATIONS`     | `FK_SLOT_RESERVATIONS_HOLD_ITEM`      | FK   | `TENANT_ID, HOLD_ITEM_ID, RESOURCE_ID`                         | `BOOKING_HOLD_ITEMS`     | `TENANT_ID, HOLD_ITEM_ID, RESOURCE_ID`              | source   |
| `BOOKING_CANCELLATIONS`          | `PK_BOOKING_CANCELLATIONS`            | PK   | `CANCELLATION_ID`                                              | `-`                      | `-`                                                 | source   |
| `BOOKING_CANCELLATIONS`          | `UQ_BC_TENANT_ID`                     | UK   | `TENANT_ID, CANCELLATION_ID`                                   | `-`                      | `-`                                                 | source   |
| `BOOKING_CANCELLATIONS`          | `FK_BC_BOOKING`                       | FK   | `TENANT_ID, BOOKING_ID`                                        | `BOOKINGS`               | `TENANT_ID, BOOKING_ID`                             | source   |
| `BOOKING_CANCELLATIONS`          | `FK_BOOKING_CANCELLATIONS_ACTOR`      | FK   | `TENANT_ID, CANCELLED_BY_MEMBERSHIP_ID`                        | `TENANT_USERS`           | `TENANT_ID, MEMBERSHIP_ID`                          | source   |
| `BOOKING_CANCELLATIONS`          | `UQ_BC_BOOKING`                       | UK   | `TENANT_ID, BOOKING_ID`                                        | `-`                      | `-`                                                 | source   |
| `BUSINESS_PAYMENT_SETTINGS`      | `PK_BUSINESS_PAYMENT_SETTINGS`        | PK   | `BUSINESS_PAYMENT_SETTINGS_ID`                                 | `-`                      | `-`                                                 | source   |
| `BUSINESS_PAYMENT_SETTINGS`      | `UQ_BPS_BUSINESS`                     | UK   | `TENANT_ID, BUSINESS_ID`                                       | `-`                      | `-`                                                 | source   |
| `BUSINESS_PAYMENT_SETTINGS`      | `FK_BPS_BUSINESS`                     | FK   | `TENANT_ID, BUSINESS_ID`                                       | `BUSINESSES`             | `TENANT_ID, BUSINESS_ID`                            | source   |
| `PAYMENTS`                       | `PK_PAYMENTS`                         | PK   | `PAYMENT_ID`                                                   | `-`                      | `-`                                                 | source   |
| `PAYMENTS`                       | `UQ_PAYMENTS_TENANT_ID`               | UK   | `TENANT_ID, PAYMENT_ID`                                        | `-`                      | `-`                                                 | source   |
| `PAYMENTS`                       | `FK_PAYMENTS_RECORDER`                | FK   | `TENANT_ID, RECORDED_BY_MEMBERSHIP_ID`                         | `TENANT_USERS`           | `TENANT_ID, MEMBERSHIP_ID`                          | source   |
| `PAYMENTS`                       | `UQ_PAYMENTS_PUBLIC_ID`               | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `PAYMENTS`                       | `FK_PAYMENTS_BOOKING`                 | FK   | `TENANT_ID, BOOKING_ID, CURRENCY_CODE`                         | `BOOKINGS`               | `TENANT_ID, BOOKING_ID, CURRENCY_CODE`              | proposed |
| `PAYMENTS`                       | `UQ_PAYMENT_CURRENCY`                 | UK   | `TENANT_ID, PAYMENT_ID, CURRENCY_CODE`                         | `-`                      | `-`                                                 | proposed |
| `PAYMENTS`                       | `FK_PAYMENT_VOID_ACTOR`               | FK   | `TENANT_ID, VOIDED_BY_MEMBERSHIP_ID`                           | `TENANT_USERS`           | `TENANT_ID, MEMBERSHIP_ID`                          | proposed |
| `REFUNDS`                        | `PK_REFUNDS`                          | PK   | `REFUND_ID`                                                    | `-`                      | `-`                                                 | source   |
| `REFUNDS`                        | `UQ_REFUNDS_TENANT_ID`                | UK   | `TENANT_ID, REFUND_ID`                                         | `-`                      | `-`                                                 | source   |
| `REFUNDS`                        | `FK_REFUNDS_RECORDER`                 | FK   | `TENANT_ID, RECORDED_BY_MEMBERSHIP_ID`                         | `TENANT_USERS`           | `TENANT_ID, MEMBERSHIP_ID`                          | source   |
| `REFUNDS`                        | `UQ_REFUNDS_PUBLIC_ID`                | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `REFUNDS`                        | `FK_REFUNDS_PAYMENT`                  | FK   | `TENANT_ID, PAYMENT_ID, CURRENCY_CODE`                         | `PAYMENTS`               | `TENANT_ID, PAYMENT_ID, CURRENCY_CODE`              | proposed |
| `SUBSCRIPTION_PLANS`             | `PK_SUBSCRIPTION_PLANS`               | PK   | `PLAN_ID`                                                      | `-`                      | `-`                                                 | source   |
| `SUBSCRIPTION_PLANS`             | `UQ_SUBSCRIPTION_PLANS_CODE`          | UK   | `PLAN_CODE`                                                    | `-`                      | `-`                                                 | source   |
| `SUBSCRIPTION_ENTITLEMENTS`      | `PK_SUBSCRIPTION_ENTITLEMENTS`        | PK   | `PLAN_ID, FEATURE_CODE`                                        | `-`                      | `-`                                                 | source   |
| `SUBSCRIPTION_ENTITLEMENTS`      | `FK_SE_PLAN`                          | FK   | `PLAN_ID`                                                      | `SUBSCRIPTION_PLANS`     | `PLAN_ID`                                           | source   |
| `SUBSCRIPTIONS`                  | `PK_SUBSCRIPTIONS`                    | PK   | `SUBSCRIPTION_ID`                                              | `-`                      | `-`                                                 | source   |
| `SUBSCRIPTIONS`                  | `UQ_SUBSCRIPTIONS_TENANT_ID`          | UK   | `TENANT_ID, SUBSCRIPTION_ID`                                   | `-`                      | `-`                                                 | source   |
| `SUBSCRIPTIONS`                  | `FK_SUBSCRIPTIONS_TENANT`             | FK   | `TENANT_ID`                                                    | `TENANTS`                | `TENANT_ID`                                         | source   |
| `SUBSCRIPTIONS`                  | `FK_SUBSCRIPTIONS_PLAN`               | FK   | `PLAN_ID`                                                      | `SUBSCRIPTION_PLANS`     | `PLAN_ID`                                           | source   |
| `SUBSCRIPTIONS`                  | `UQ_SUBSCRIPTION_CURRENCY`            | UK   | `TENANT_ID, SUBSCRIPTION_ID, CURRENCY_CODE`                    | `-`                      | `-`                                                 | proposed |
| `SUBSCRIPTION_INVOICES`          | `PK_SUBSCRIPTION_INVOICES`            | PK   | `SUBSCRIPTION_INVOICE_ID`                                      | `-`                      | `-`                                                 | source   |
| `SUBSCRIPTION_INVOICES`          | `UQ_SI_TENANT_ID`                     | UK   | `TENANT_ID, SUBSCRIPTION_INVOICE_ID`                           | `-`                      | `-`                                                 | source   |
| `SUBSCRIPTION_INVOICES`          | `UQ_SI_NUMBER`                        | UK   | `TENANT_ID, INVOICE_NUMBER`                                    | `-`                      | `-`                                                 | source   |
| `SUBSCRIPTION_INVOICES`          | `FK_SI_SUBSCRIPTION`                  | FK   | `TENANT_ID, SUBSCRIPTION_ID, CURRENCY_CODE`                    | `SUBSCRIPTIONS`          | `TENANT_ID, SUBSCRIPTION_ID, CURRENCY_CODE`         | proposed |
| `SUBSCRIPTION_INVOICES`          | `UQ_INVOICE_CURRENCY`                 | UK   | `TENANT_ID, SUBSCRIPTION_INVOICE_ID, CURRENCY_CODE`            | `-`                      | `-`                                                 | proposed |
| `SUBSCRIPTION_PAYMENTS`          | `PK_SUBSCRIPTION_PAYMENTS`            | PK   | `SUBSCRIPTION_PAYMENT_ID`                                      | `-`                      | `-`                                                 | source   |
| `SUBSCRIPTION_PAYMENTS`          | `UQ_SP_TENANT_ID`                     | UK   | `TENANT_ID, SUBSCRIPTION_PAYMENT_ID`                           | `-`                      | `-`                                                 | source   |
| `SUBSCRIPTION_PAYMENTS`          | `FK_SUBSCRIPTION_PAYMENTS_USER`       | FK   | `RECORDED_BY_USER_ID`                                          | `USERS`                  | `USER_ID`                                           | source   |
| `SUBSCRIPTION_PAYMENTS`          | `UQ_SUBSCRIPTION_PAYMENTS_PUBLIC_ID`  | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `SUBSCRIPTION_PAYMENTS`          | `FK_SP_VOID_USER`                     | FK   | `VOIDED_BY_USER_ID`                                            | `USERS`                  | `USER_ID`                                           | proposed |
| `SUBSCRIPTION_PAYMENTS`          | `FK_SP_INVOICE`                       | FK   | `TENANT_ID, SUBSCRIPTION_INVOICE_ID, CURRENCY_CODE`            | `SUBSCRIPTION_INVOICES`  | `TENANT_ID, SUBSCRIPTION_INVOICE_ID, CURRENCY_CODE` | proposed |
| `SUBSCRIPTION_PAYMENTS`          | `FK_SP_ADMIN_ACTOR`                   | FK   | `RECORDED_BY_PLATFORM_ADMIN_ID, RECORDED_BY_USER_ID`           | `PLATFORM_ADMINS`        | `PLATFORM_ADMIN_ID, USER_ID`                        | proposed |
| `WEBSITE_THEMES`                 | `PK_WEBSITE_THEMES`                   | PK   | `THEME_ID`                                                     | `-`                      | `-`                                                 | source   |
| `WEBSITE_THEMES`                 | `UQ_WEBSITE_THEMES_CODE`              | UK   | `THEME_CODE`                                                   | `-`                      | `-`                                                 | source   |
| `WEBSITE_SETTINGS`               | `PK_WEBSITE_SETTINGS`                 | PK   | `WEBSITE_ID`                                                   | `-`                      | `-`                                                 | source   |
| `WEBSITE_SETTINGS`               | `UQ_WEBSITE_SETTINGS_TENANT_ID`       | UK   | `TENANT_ID, WEBSITE_ID`                                        | `-`                      | `-`                                                 | source   |
| `WEBSITE_SETTINGS`               | `UQ_WEBSITE_SETTINGS_BUSINESS`        | UK   | `TENANT_ID, BUSINESS_ID`                                       | `-`                      | `-`                                                 | source   |
| `WEBSITE_SETTINGS`               | `UQ_WEBSITE_SETTINGS_SUBDOMAIN`       | UK   | `SUBDOMAIN_SLUG`                                               | `-`                      | `-`                                                 | source   |
| `WEBSITE_SETTINGS`               | `FK_WEBSITE_SETTINGS_BUSINESS`        | FK   | `TENANT_ID, BUSINESS_ID`                                       | `BUSINESSES`             | `TENANT_ID, BUSINESS_ID`                            | source   |
| `WEBSITE_SETTINGS`               | `FK_WEBSITE_SETTINGS_THEME`           | FK   | `THEME_ID`                                                     | `WEBSITE_THEMES`         | `THEME_ID`                                          | source   |
| `WEBSITE_SETTINGS`               | `UQ_WEBSITE_SETTINGS_PUBLIC_ID`       | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `WEBSITE_MEDIA`                  | `PK_WEBSITE_MEDIA`                    | PK   | `WEBSITE_MEDIA_ID`                                             | `-`                      | `-`                                                 | source   |
| `WEBSITE_MEDIA`                  | `UQ_WEBSITE_MEDIA_TENANT_ID`          | UK   | `TENANT_ID, WEBSITE_MEDIA_ID`                                  | `-`                      | `-`                                                 | source   |
| `WEBSITE_MEDIA`                  | `UQ_WEBSITE_MEDIA_OBJECT_KEY`         | UK   | `OBJECT_KEY`                                                   | `-`                      | `-`                                                 | source   |
| `WEBSITE_MEDIA`                  | `FK_WEBSITE_MEDIA_BUSINESS`           | FK   | `TENANT_ID, BUSINESS_ID`                                       | `BUSINESSES`             | `TENANT_ID, BUSINESS_ID`                            | source   |
| `WEBSITE_MEDIA`                  | `FK_WEBSITE_MEDIA_LOCATION`           | FK   | `TENANT_ID, BUSINESS_ID, LOCATION_ID`                          | `LOCATIONS`              | `TENANT_ID, BUSINESS_ID, LOCATION_ID`               | source   |
| `WEBSITE_MEDIA`                  | `FK_WEBSITE_MEDIA_RESOURCE`           | FK   | `TENANT_ID, BUSINESS_ID, LOCATION_ID, RESOURCE_ID`             | `RESOURCES`              | `TENANT_ID, BUSINESS_ID, LOCATION_ID, RESOURCE_ID`  | source   |
| `WEBSITE_MEDIA`                  | `UQ_WEBSITE_MEDIA_PUBLIC_ID`          | UK   | `TENANT_ID, PUBLIC_ID`                                         | `-`                      | `-`                                                 | proposed |
| `NOTIFICATION_TEMPLATES`         | `PK_NOTIFICATION_TEMPLATES`           | PK   | `NOTIFICATION_TEMPLATE_ID`                                     | `-`                      | `-`                                                 | source   |
| `NOTIFICATION_TEMPLATES`         | `FK_NT_TENANT`                        | FK   | `TENANT_ID`                                                    | `TENANTS`                | `TENANT_ID`                                         | source   |
| `NOTIFICATIONS`                  | `PK_NOTIFICATIONS`                    | PK   | `NOTIFICATION_ID`                                              | `-`                      | `-`                                                 | source   |
| `NOTIFICATIONS`                  | `UQ_NOTIFICATIONS_TENANT_ID`          | UK   | `TENANT_ID, NOTIFICATION_ID`                                   | `-`                      | `-`                                                 | source   |
| `NOTIFICATIONS`                  | `FK_NOTIFICATIONS_TENANT`             | FK   | `TENANT_ID`                                                    | `TENANTS`                | `TENANT_ID`                                         | source   |
| `NOTIFICATIONS`                  | `FK_NOTIFICATIONS_TEMPLATE`           | FK   | `NOTIFICATION_TEMPLATE_ID`                                     | `NOTIFICATION_TEMPLATES` | `NOTIFICATION_TEMPLATE_ID`                          | source   |
| `NOTIFICATIONS`                  | `FK_NOTIFICATIONS_BOOKING`            | FK   | `TENANT_ID, BOOKING_ID`                                        | `BOOKINGS`               | `TENANT_ID, BOOKING_ID`                             | source   |
| `NOTIFICATIONS`                  | `FK_NOTIFICATIONS_USER`               | FK   | `RECIPIENT_USER_ID`                                            | `USERS`                  | `USER_ID`                                           | source   |
| `NOTIFICATIONS`                  | `UQ_NOTIFICATION_SCOPE`               | UK   | `SCOPE_TENANT_ID, NOTIFICATION_ID`                             | `-`                      | `-`                                                 | proposed |
| `NOTIFICATIONS`                  | `UQ_NOTIFICATION_DEDUPE`              | UK   | `SCOPE_TENANT_ID, DEDUPE_KEY`                                  | `-`                      | `-`                                                 | proposed |
| `NOTIFICATION_LOGS`              | `PK_NOTIFICATION_LOGS`                | PK   | `NOTIFICATION_LOG_ID`                                          | `-`                      | `-`                                                 | source   |
| `NOTIFICATION_LOGS`              | `UQ_NOTIFICATION_LOGS_TENANT_ID`      | UK   | `TENANT_ID, NOTIFICATION_LOG_ID`                               | `-`                      | `-`                                                 | source   |
| `NOTIFICATION_LOGS`              | `FK_NL_NOTIFICATION`                  | FK   | `TENANT_ID, NOTIFICATION_ID`                                   | `NOTIFICATIONS`          | `TENANT_ID, NOTIFICATION_ID`                        | source   |
| `NOTIFICATION_LOGS`              | `FK_NL_SCOPE`                         | FK   | `SCOPE_TENANT_ID, NOTIFICATION_ID`                             | `NOTIFICATIONS`          | `SCOPE_TENANT_ID, NOTIFICATION_ID`                  | proposed |
| `NOTIFICATION_LOGS`              | `FK_NL_TENANT`                        | FK   | `TENANT_ID`                                                    | `TENANTS`                | `TENANT_ID`                                         | proposed |
| `NOTIFICATION_LOGS`              | `UQ_NOTIFICATION_ATTEMPT`             | UK   | `SCOPE_TENANT_ID, NOTIFICATION_ID, ATTEMPT_NUMBER`             | `-`                      | `-`                                                 | proposed |
| `OUTBOX_EVENTS`                  | `PK_OUTBOX_EVENTS`                    | PK   | `OUTBOX_EVENT_ID`                                              | `-`                      | `-`                                                 | source   |
| `OUTBOX_EVENTS`                  | `FK_OUTBOX_EVENTS_TENANT`             | FK   | `TENANT_ID`                                                    | `TENANTS`                | `TENANT_ID`                                         | source   |
| `JOB_QUEUE`                      | `PK_JOB_QUEUE`                        | PK   | `JOB_ID`                                                       | `-`                      | `-`                                                 | source   |
| `JOB_QUEUE`                      | `FK_JOB_QUEUE_TENANT`                 | FK   | `TENANT_ID`                                                    | `TENANTS`                | `TENANT_ID`                                         | source   |
| `IDEMPOTENCY_KEYS`               | `PK_IDEMPOTENCY_KEYS`                 | PK   | `IDEMPOTENCY_ID`                                               | `-`                      | `-`                                                 | source   |
| `IDEMPOTENCY_KEYS`               | `FK_IDEMPOTENCY_KEYS_TENANT`          | FK   | `TENANT_ID`                                                    | `TENANTS`                | `TENANT_ID`                                         | source   |
| `IDEMPOTENCY_KEYS`               | `UQ_IDEMPOTENCY_OWNER_KEY`            | UK   | `TENANT_ID, OPERATION_SCOPE, OWNER_SCOPE, IDEMPOTENCY_KEY`     | `-`                      | `-`                                                 | proposed |
| `AUDIT_LOGS`                     | `PK_AUDIT_LOGS`                       | PK   | `AUDIT_LOG_ID`                                                 | `-`                      | `-`                                                 | source   |
| `AUDIT_LOGS`                     | `FK_AUDIT_LOGS_TENANT`                | FK   | `TENANT_ID`                                                    | `TENANTS`                | `TENANT_ID`                                         | source   |
| `AUDIT_LOGS`                     | `FK_AUDIT_LOGS_USER`                  | FK   | `ACTOR_USER_ID`                                                | `USERS`                  | `USER_ID`                                           | source   |
| `AUDIT_LOGS`                     | `FK_AUDIT_LOGS_MEMBERSHIP_ACTOR`      | FK   | `TENANT_ID, ACTOR_MEMBERSHIP_ID, ACTOR_USER_ID`                | `TENANT_USERS`           | `TENANT_ID, MEMBERSHIP_ID, USER_ID`                 | source   |
| `AUDIT_LOGS`                     | `UQ_AUDIT_LOGS_PUBLIC_ID`             | UK   | `PUBLIC_ID`                                                    | `-`                      | `-`                                                 | proposed |
| `AUDIT_LOGS`                     | `FK_AUDIT_ADMIN_USER`                 | FK   | `ACTOR_PLATFORM_ADMIN_ID, ACTOR_USER_ID`                       | `PLATFORM_ADMINS`        | `PLATFORM_ADMIN_ID, USER_ID`                        | proposed |
| `ONBOARDING_PROGRESS`            | `PK_ONBOARDING_PROGRESS`              | PK   | `ONBOARDING_PROGRESS_ID`                                       | `-`                      | `-`                                                 | source   |
| `ONBOARDING_PROGRESS`            | `UQ_ONBOARDING_STEP`                  | UK   | `TENANT_ID, BUSINESS_ID, STEP_CODE`                            | `-`                      | `-`                                                 | source   |
| `ONBOARDING_PROGRESS`            | `FK_ONBOARDING_BUSINESS`              | FK   | `TENANT_ID, BUSINESS_ID`                                       | `BUSINESSES`             | `TENANT_ID, BUSINESS_ID`                            | source   |
| `INVITATION_LOCATIONS`           | `PK_INVITATION_LOCATIONS`             | PK   | `TENANT_ID, INVITATION_ID, LOCATION_ID`                        | `-`                      | `-`                                                 | proposed |
| `INVITATION_LOCATIONS`           | `FK_IL_INVITATION`                    | FK   | `TENANT_ID, INVITATION_ID`                                     | `TENANT_INVITATIONS`     | `TENANT_ID, INVITATION_ID`                          | proposed |
| `INVITATION_LOCATIONS`           | `FK_IL_LOCATION`                      | FK   | `TENANT_ID, LOCATION_ID`                                       | `LOCATIONS`              | `TENANT_ID, LOCATION_ID`                            | proposed |
| `SUBSCRIPTION_FEATURE_SNAPSHOTS` | `PK_SUB_FEATURE_SNAPSHOTS`            | PK   | `TENANT_ID, SUBSCRIPTION_ID, FEATURE_CODE`                     | `-`                      | `-`                                                 | proposed |
| `SUBSCRIPTION_FEATURE_SNAPSHOTS` | `FK_SFS_SUBSCRIPTION`                 | FK   | `TENANT_ID, SUBSCRIPTION_ID`                                   | `SUBSCRIPTIONS`          | `TENANT_ID, SUBSCRIPTION_ID`                        | proposed |

## Exact checks

NOT NULL declarations are in the dictionary. Oracle CHECK accepts TRUE or UNKNOWN, so conditional-required checks below explicitly test IS NOT NULL; a bounds comparison alone is insufficient. Cross-row sums, permitted state transitions and field immutability are application/privilege invariants, not claimed CHECK guarantees.

### SCHEMA_MIGRATIONS

<a id="ck_migration_record"></a>

- `CK_MIGRATION_RECORD` (proposed): `CHECK (execution_status IN ('RUNNING','APPLIED','FAILED') AND attempt_count>0 AND REGEXP_LIKE(checksum,'^[0-9a-f]{64}$','c') AND (repair_version IS NULL OR (execution_status='FAILED' AND repair_version<>version)))`
  <a id="ck_migration_times"></a>
- `CK_MIGRATION_TIMES` (proposed): `CHECK ((execution_status='RUNNING' AND installed_at_utc IS NULL AND finished_at_utc IS NULL AND execution_ms IS NULL) OR (execution_status='APPLIED' AND installed_at_utc IS NOT NULL AND finished_at_utc IS NOT NULL AND execution_ms IS NOT NULL AND execution_ms>=0 AND error_code IS NULL) OR (execution_status='FAILED' AND installed_at_utc IS NULL AND finished_at_utc IS NOT NULL AND execution_ms IS NOT NULL AND execution_ms>=0 AND error_code IS NOT NULL))`

### TENANTS

<a id="ck_tenants_status"></a>

- `CK_TENANTS_STATUS` (source): `CHECK (status IN ('TRIAL','ACTIVE','SUSPENDED','CLOSED'))`
  <a id="ck_tenants_currency"></a>
- `CK_TENANTS_CURRENCY` (source): `CHECK (REGEXP_LIKE(default_currency, '^[A-Z]{3}$'))`
  <a id="ck_tenants_uuid"></a>
- `CK_TENANTS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_tenants_default_currency"></a>
- `CK_TENANTS_DEFAULT_CURRENCY` (proposed): `CHECK (REGEXP_LIKE(DEFAULT_CURRENCY,'^[A-Z]{3}$','c'))`
  <a id="ck_tenants_id_positive"></a>
- `CK_TENANTS_ID_POSITIVE` (proposed): `CHECK (TENANT_ID>0 AND TENANT_ID=TRUNC(TENANT_ID))`

### USERS

<a id="ck_users_status"></a>

- `CK_USERS_STATUS` (source): `CHECK (account_status IN ('PENDING','ACTIVE','LOCKED','DISABLED'))`
  <a id="ck_users_email_pair"></a>
- `CK_USERS_EMAIL_PAIR` (source): `CHECK ((email IS NULL AND email_normalized IS NULL) OR (email IS NOT NULL AND email_normalized IS NOT NULL))`
  <a id="ck_users_uuid"></a>
- `CK_USERS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_users_id_positive"></a>
- `CK_USERS_ID_POSITIVE` (proposed): `CHECK (USER_ID>0 AND USER_ID=TRUNC(USER_ID))`

### PLATFORM_SETTINGS

<a id="ck_platform_settings_type"></a>

- `CK_PLATFORM_SETTINGS_TYPE` (source): `CHECK (value_type IN ('STRING','NUMBER','BOOLEAN','JSON','TEXT'))`
  <a id="ck_platform_settings_public"></a>
- `CK_PLATFORM_SETTINGS_PUBLIC` (source): `CHECK (is_public IN ('Y','N'))`

### TENANT_USERS

<a id="ck_tenant_users_status"></a>

- `CK_TENANT_USERS_STATUS` (source): `CHECK (membership_status IN ('INVITED','ACTIVE','SUSPENDED','REVOKED'))`
  <a id="ck_tenant_users_uuid"></a>
- `CK_TENANT_USERS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_tenant_users_id_positive"></a>
- `CK_TENANT_USERS_ID_POSITIVE` (proposed): `CHECK (MEMBERSHIP_ID>0 AND MEMBERSHIP_ID=TRUNC(MEMBERSHIP_ID))`

### AUTH_SESSIONS

<a id="ck_auth_sessions_expiry"></a>

- `CK_AUTH_SESSIONS_EXPIRY` (source): `CHECK (expires_at_utc > created_at_utc)`
  <a id="ck_auth_sessions_token_hash"></a>
- `CK_AUTH_SESSIONS_TOKEN_HASH` (proposed): `CHECK (REGEXP_LIKE(TOKEN_HASH,'^[0-9a-f]{64}$','c'))`
  <a id="ck_auth_sessions_id_positive"></a>
- `CK_AUTH_SESSIONS_ID_POSITIVE` (proposed): `CHECK (SESSION_ID>0 AND SESSION_ID=TRUNC(SESSION_ID))`
  <a id="ck_session_audience"></a>
- `CK_SESSION_AUDIENCE` (proposed): `CHECK (audience IN ('DASHBOARD','ADMIN'))`
  <a id="ck_session_member_pair"></a>
- `CK_SESSION_MEMBER_PAIR` (proposed): `CHECK ((active_tenant_id IS NULL AND active_membership_id IS NULL) OR (audience='DASHBOARD' AND active_tenant_id IS NOT NULL AND active_membership_id IS NOT NULL))`

### EMAIL_VERIFICATION_TOKENS

<a id="ck_email_verification_tokens_token_hash"></a>

- `CK_EMAIL_VERIFICATION_TOKENS_TOKEN_HASH` (proposed): `CHECK (REGEXP_LIKE(TOKEN_HASH,'^[0-9a-f]{64}$','c'))`
  <a id="ck_email_verification_tokens_uuid"></a>
- `CK_EMAIL_VERIFICATION_TOKENS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_email_verification_tokens_id_positive"></a>
- `CK_EMAIL_VERIFICATION_TOKENS_ID_POSITIVE` (proposed): `CHECK (VERIFICATION_ID>0 AND VERIFICATION_ID=TRUNC(VERIFICATION_ID))`
  <a id="ck_email_verification_tokens_expiry"></a>
- `CK_EMAIL_VERIFICATION_TOKENS_EXPIRY` (proposed): `CHECK (expires_at_utc>created_at_utc)`

### PASSWORD_RESET_TOKENS

<a id="ck_password_reset_tokens_token_hash"></a>

- `CK_PASSWORD_RESET_TOKENS_TOKEN_HASH` (proposed): `CHECK (REGEXP_LIKE(TOKEN_HASH,'^[0-9a-f]{64}$','c'))`
  <a id="ck_password_reset_tokens_uuid"></a>
- `CK_PASSWORD_RESET_TOKENS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_password_reset_tokens_id_positive"></a>
- `CK_PASSWORD_RESET_TOKENS_ID_POSITIVE` (proposed): `CHECK (RESET_ID>0 AND RESET_ID=TRUNC(RESET_ID))`
  <a id="ck_password_reset_tokens_expiry"></a>
- `CK_PASSWORD_RESET_TOKENS_EXPIRY` (proposed): `CHECK (expires_at_utc>created_at_utc)`

### PLATFORM_ADMINS

<a id="ck_platform_admins_role"></a>

- `CK_PLATFORM_ADMINS_ROLE` (source): `CHECK (admin_role_code IN ('SUPER_ADMIN','PLATFORM_ADMIN','SUPPORT_AGENT'))`
  <a id="ck_platform_admins_status"></a>
- `CK_PLATFORM_ADMINS_STATUS` (source): `CHECK (admin_status IN ('ACTIVE','DISABLED'))`
  <a id="ck_platform_admins_id_positive"></a>
- `CK_PLATFORM_ADMINS_ID_POSITIVE` (proposed): `CHECK (PLATFORM_ADMIN_ID>0 AND PLATFORM_ADMIN_ID=TRUNC(PLATFORM_ADMIN_ID))`

### ROLES

<a id="ck_roles_system"></a>

- `CK_ROLES_SYSTEM` (source): `CHECK (is_system_role IN ('Y','N'))`
  <a id="ck_roles_active"></a>
- `CK_ROLES_ACTIVE` (source): `CHECK (is_active IN ('Y','N'))`
  <a id="ck_roles_id_positive"></a>
- `CK_ROLES_ID_POSITIVE` (proposed): `CHECK (ROLE_ID>0 AND ROLE_ID=TRUNC(ROLE_ID))`

### PERMISSIONS

<a id="ck_permissions_id_positive"></a>

- `CK_PERMISSIONS_ID_POSITIVE` (proposed): `CHECK (PERMISSION_ID>0 AND PERMISSION_ID=TRUNC(PERMISSION_ID))`

### ROLE_PERMISSIONS

### USER_ROLES

### TENANT_INVITATIONS

<a id="ck_tenant_invitations_status"></a>

- `CK_TENANT_INVITATIONS_STATUS` (source): `CHECK (invitation_status IN ('PENDING','ACCEPTED','EXPIRED','REVOKED'))`
  <a id="ck_tenant_invitations_token_hash"></a>
- `CK_TENANT_INVITATIONS_TOKEN_HASH` (proposed): `CHECK (REGEXP_LIKE(TOKEN_HASH,'^[0-9a-f]{64}$','c'))`
  <a id="ck_tenant_invitations_uuid"></a>
- `CK_TENANT_INVITATIONS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_tenant_invitations_id_positive"></a>
- `CK_TENANT_INVITATIONS_ID_POSITIVE` (proposed): `CHECK (INVITATION_ID>0 AND INVITATION_ID=TRUNC(INVITATION_ID))`
  <a id="ck_tenant_invitations_expiry"></a>
- `CK_TENANT_INVITATIONS_EXPIRY` (proposed): `CHECK (expires_at_utc>created_at_utc)`

### BUSINESSES

<a id="ck_businesses_status"></a>

- `CK_BUSINESSES_STATUS` (source): `CHECK (business_status IN ('SETUP','ACTIVE','SUSPENDED','CLOSED'))`
  <a id="ck_businesses_uuid"></a>
- `CK_BUSINESSES_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_businesses_id_positive"></a>
- `CK_BUSINESSES_ID_POSITIVE` (proposed): `CHECK (BUSINESS_ID>0 AND BUSINESS_ID=TRUNC(BUSINESS_ID))`

### BUSINESS_PROFILES

<a id="ck_business_profiles_lat"></a>

- `CK_BUSINESS_PROFILES_LAT` (source): `CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90)`
  <a id="ck_business_profiles_lon"></a>
- `CK_BUSINESS_PROFILES_LON` (source): `CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)`
  <a id="ck_business_profiles_id_positive"></a>
- `CK_BUSINESS_PROFILES_ID_POSITIVE` (proposed): `CHECK (BUSINESS_PROFILE_ID>0 AND BUSINESS_PROFILE_ID=TRUNC(BUSINESS_PROFILE_ID))`

### LOCATIONS

<a id="ck_locations_status"></a>

- `CK_LOCATIONS_STATUS` (source): `CHECK (location_status IN ('ACTIVE','INACTIVE','CLOSED'))`
  <a id="ck_locations_lat"></a>
- `CK_LOCATIONS_LAT` (source): `CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90)`
  <a id="ck_locations_lon"></a>
- `CK_LOCATIONS_LON` (source): `CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)`
  <a id="ck_locations_uuid"></a>
- `CK_LOCATIONS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_locations_id_positive"></a>
- `CK_LOCATIONS_ID_POSITIVE` (proposed): `CHECK (LOCATION_ID>0 AND LOCATION_ID=TRUNC(LOCATION_ID))`

### STAFF_ASSIGNMENTS

<a id="ck_staff_assignments_status"></a>

- `CK_STAFF_ASSIGNMENTS_STATUS` (source): `CHECK (assignment_status IN ('ACTIVE','ENDED'))`
  <a id="ck_staff_assignments_uuid"></a>
- `CK_STAFF_ASSIGNMENTS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_staff_assignments_id_positive"></a>
- `CK_STAFF_ASSIGNMENTS_ID_POSITIVE` (proposed): `CHECK (STAFF_ASSIGNMENT_ID>0 AND STAFF_ASSIGNMENT_ID=TRUNC(STAFF_ASSIGNMENT_ID))`

### SPORTS

<a id="ck_sports_active"></a>

- `CK_SPORTS_ACTIVE` (source): `CHECK (is_active IN ('Y','N'))`
  <a id="ck_sports_id_positive"></a>
- `CK_SPORTS_ID_POSITIVE` (proposed): `CHECK (SPORT_ID>0 AND SPORT_ID=TRUNC(SPORT_ID))`

### BUSINESS_SPORTS

<a id="ck_business_sports_status"></a>

- `CK_BUSINESS_SPORTS_STATUS` (source): `CHECK (status IN ('ACTIVE','INACTIVE'))`

### RESOURCES

<a id="ck_resources_slot_interval"></a>

- `CK_RESOURCES_SLOT_INTERVAL` (source): `CHECK (slot_interval_minutes = 15)`
  <a id="ck_resources_durations"></a>
- `CK_RESOURCES_DURATIONS` (source): `CHECK (minimum_duration_minutes > 0 AND maximum_duration_minutes >= minimum_duration_minutes AND MOD(minimum_duration_minutes,15) = 0 AND MOD(maximum_duration_minutes,15) = 0)`
  <a id="ck_resources_capacity"></a>
- `CK_RESOURCES_CAPACITY` (source): `CHECK (capacity IS NULL OR capacity > 0)`
  <a id="ck_resources_bookable"></a>
- `CK_RESOURCES_BOOKABLE` (source): `CHECK (is_bookable IN ('Y','N'))`
  <a id="ck_resources_status"></a>
- `CK_RESOURCES_STATUS` (source): `CHECK (resource_status IN ('ACTIVE','INACTIVE','MAINTENANCE','CLOSED'))`
  <a id="ck_resources_uuid"></a>
- `CK_RESOURCES_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_resources_id_positive"></a>
- `CK_RESOURCES_ID_POSITIVE` (proposed): `CHECK (RESOURCE_ID>0 AND RESOURCE_ID=TRUNC(RESOURCE_ID))`
  <a id="ck_resource_buffers"></a>
- `CK_RESOURCE_BUFFERS` (proposed): `CHECK (buffer_before_minutes>=0 AND buffer_after_minutes>=0 AND MOD(buffer_before_minutes,15)=0 AND MOD(buffer_after_minutes,15)=0 AND advance_booking_days>=0)`

### RESOURCE_FEATURES

<a id="ck_resource_features_id_positive"></a>

- `CK_RESOURCE_FEATURES_ID_POSITIVE` (proposed): `CHECK (RESOURCE_FEATURE_ID>0 AND RESOURCE_FEATURE_ID=TRUNC(RESOURCE_FEATURE_ID))`

### OPERATING_HOURS

<a id="ck_operating_hours_day"></a>

- `CK_OPERATING_HOURS_DAY` (source): `CHECK (day_of_week BETWEEN 1 AND 7)`
  <a id="ck_operating_hours_closed"></a>
- `CK_OPERATING_HOURS_CLOSED` (source): `CHECK (is_closed IN ('Y','N'))`
  <a id="ck_operating_hours_uuid"></a>
- `CK_OPERATING_HOURS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_operating_hours_id_positive"></a>
- `CK_OPERATING_HOURS_ID_POSITIVE` (proposed): `CHECK (OPERATING_HOUR_ID>0 AND OPERATING_HOUR_ID=TRUNC(OPERATING_HOUR_ID))`
  <a id="ck_oh_segment"></a>
- `CK_OH_SEGMENT` (proposed): `CHECK (segment_no BETWEEN 1 AND 999)`
  <a id="ck_operating_hours_times"></a>
- `CK_OPERATING_HOURS_TIMES` (proposed): `CHECK ((is_closed='Y' AND open_minute IS NULL AND close_minute IS NULL) OR (is_closed='N' AND open_minute IS NOT NULL AND close_minute IS NOT NULL AND open_minute BETWEEN 0 AND 1439 AND close_minute BETWEEN 1 AND 1440 AND close_minute>open_minute AND MOD(open_minute,15)=0 AND MOD(close_minute,15)=0))`

### HOLIDAYS

<a id="ck_holidays_date"></a>

- `CK_HOLIDAYS_DATE` (source): `CHECK (holiday_date = TRUNC(holiday_date))`
  <a id="ck_holidays_closed"></a>
- `CK_HOLIDAYS_CLOSED` (source): `CHECK (is_closed IN ('Y','N'))`
  <a id="ck_holidays_uuid"></a>
- `CK_HOLIDAYS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_holidays_id_positive"></a>
- `CK_HOLIDAYS_ID_POSITIVE` (proposed): `CHECK (HOLIDAY_ID>0 AND HOLIDAY_ID=TRUNC(HOLIDAY_ID))`
  <a id="ck_holidays_times"></a>
- `CK_HOLIDAYS_TIMES` (proposed): `CHECK ((is_closed='Y' AND open_minute IS NULL AND close_minute IS NULL) OR (is_closed='N' AND open_minute IS NOT NULL AND close_minute IS NOT NULL AND open_minute BETWEEN 0 AND 1439 AND close_minute BETWEEN 1 AND 1440 AND close_minute>open_minute AND MOD(open_minute,15)=0 AND MOD(close_minute,15)=0))`
  <a id="ck_holiday_status"></a>
- `CK_HOLIDAY_STATUS` (proposed): `CHECK (holiday_status IN ('ACTIVE','INACTIVE'))`

### AVAILABILITY_BLOCKS

<a id="ck_availability_blocks_range"></a>

- `CK_AVAILABILITY_BLOCKS_RANGE` (source): `CHECK (ends_at_utc > starts_at_utc)`
  <a id="ck_availability_blocks_type"></a>
- `CK_AVAILABILITY_BLOCKS_TYPE` (source): `CHECK (block_type IN ('MAINTENANCE','REPAIR','PRIVATE_EVENT','CLEANING','CLOSURE','OTHER'))`
  <a id="ck_availability_blocks_status"></a>
- `CK_AVAILABILITY_BLOCKS_STATUS` (source): `CHECK (block_status IN ('ACTIVE','CANCELLED'))`
  <a id="ck_availability_blocks_uuid"></a>
- `CK_AVAILABILITY_BLOCKS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_availability_blocks_id_positive"></a>
- `CK_AVAILABILITY_BLOCKS_ID_POSITIVE` (proposed): `CHECK (AVAILABILITY_BLOCK_ID>0 AND AVAILABILITY_BLOCK_ID=TRUNC(AVAILABILITY_BLOCK_ID))`

### PRICING_RULES

<a id="ck_pricing_rules_rate"></a>

- `CK_PRICING_RULES_RATE` (source): `CHECK (hourly_rate >= 0)`
  <a id="ck_pricing_rules_range"></a>
- `CK_PRICING_RULES_RANGE` (source): `CHECK (effective_to_utc IS NULL OR effective_to_utc > effective_from_utc)`
  <a id="ck_pricing_rules_status"></a>
- `CK_PRICING_RULES_STATUS` (source): `CHECK (rule_status IN ('ACTIVE','INACTIVE'))`
  <a id="ck_pricing_rules_currency_code"></a>
- `CK_PRICING_RULES_CURRENCY_CODE` (proposed): `CHECK (REGEXP_LIKE(CURRENCY_CODE,'^[A-Z]{3}$','c'))`
  <a id="ck_pricing_rules_uuid"></a>
- `CK_PRICING_RULES_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_pricing_rules_id_positive"></a>
- `CK_PRICING_RULES_ID_POSITIVE` (proposed): `CHECK (PRICING_RULE_ID>0 AND PRICING_RULE_ID=TRUNC(PRICING_RULE_ID))`

### CUSTOMERS

<a id="ck_customers_email_pair"></a>

- `CK_CUSTOMERS_EMAIL_PAIR` (source): `CHECK ((email IS NULL AND email_normalized IS NULL) OR (email IS NOT NULL AND email_normalized IS NOT NULL))`
  <a id="ck_customers_status"></a>
- `CK_CUSTOMERS_STATUS` (source): `CHECK (customer_status IN ('ACTIVE','INACTIVE','BLOCKED'))`
  <a id="ck_customers_uuid"></a>
- `CK_CUSTOMERS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_customers_id_positive"></a>
- `CK_CUSTOMERS_ID_POSITIVE` (proposed): `CHECK (CUSTOMER_ID>0 AND CUSTOMER_ID=TRUNC(CUSTOMER_ID))`

### BOOKING_HOLDS

<a id="ck_booking_holds_status"></a>

- `CK_BOOKING_HOLDS_STATUS` (source): `CHECK (hold_status IN ('ACTIVE','CONVERTED','EXPIRED','RELEASED'))`
  <a id="ck_booking_holds_expiry"></a>
- `CK_BOOKING_HOLDS_EXPIRY` (source): `CHECK (expires_at_utc > created_at_utc)`
  <a id="ck_booking_holds_uuid"></a>
- `CK_BOOKING_HOLDS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_booking_holds_hold_token_hash"></a>
- `CK_BOOKING_HOLDS_HOLD_TOKEN_HASH` (proposed): `CHECK (REGEXP_LIKE(HOLD_TOKEN_HASH,'^[0-9a-f]{64}$','c'))`
  <a id="ck_booking_holds_id_positive"></a>
- `CK_BOOKING_HOLDS_ID_POSITIVE` (proposed): `CHECK (HOLD_ID>0 AND HOLD_ID=TRUNC(HOLD_ID))`
  <a id="ck_hold_checkout_digest"></a>
- `CK_HOLD_CHECKOUT_DIGEST` (proposed): `CHECK (REGEXP_LIKE(checkout_session_key,'^[0-9a-f]{64}$','c'))`

### BOOKING_HOLD_ITEMS

<a id="ck_booking_hold_items_range"></a>

- `CK_BOOKING_HOLD_ITEMS_RANGE` (source): `CHECK (ends_at_utc > starts_at_utc)`
  <a id="ck_booking_hold_items_duration"></a>
- `CK_BOOKING_HOLD_ITEMS_DURATION` (source): `CHECK (duration_minutes > 0 AND MOD(duration_minutes,15) = 0 AND (ends_at_utc - starts_at_utc) = NUMTODSINTERVAL(duration_minutes,'MINUTE'))`
  <a id="ck_booking_hold_items_grid"></a>
- `CK_BOOKING_HOLD_ITEMS_GRID` (source): `CHECK (MOD(EXTRACT(MINUTE FROM starts_at_utc),15) = 0 AND EXTRACT(SECOND FROM starts_at_utc) = 0)`
  <a id="ck_booking_hold_items_amounts"></a>
- `CK_BOOKING_HOLD_ITEMS_AMOUNTS` (source): `CHECK (hourly_rate_snapshot >= 0 AND line_total >= 0)`
  <a id="ck_booking_hold_items_currency_code"></a>
- `CK_BOOKING_HOLD_ITEMS_CURRENCY_CODE` (proposed): `CHECK (REGEXP_LIKE(CURRENCY_CODE,'^[A-Z]{3}$','c'))`
  <a id="ck_booking_hold_items_id_positive"></a>
- `CK_BOOKING_HOLD_ITEMS_ID_POSITIVE` (proposed): `CHECK (HOLD_ITEM_ID>0 AND HOLD_ITEM_ID=TRUNC(HOLD_ITEM_ID))`
  <a id="ck_booking_hold_items_occupancy"></a>
- `CK_BOOKING_HOLD_ITEMS_OCCUPANCY` (proposed): `CHECK (buffer_before_minutes>=0 AND buffer_after_minutes>=0 AND MOD(buffer_before_minutes,15)=0 AND MOD(buffer_after_minutes,15)=0 AND occupied_start_utc=starts_at_utc-NUMTODSINTERVAL(buffer_before_minutes,'MINUTE') AND occupied_end_utc=ends_at_utc+NUMTODSINTERVAL(buffer_after_minutes,'MINUTE'))`

### BOOKINGS

<a id="ck_bookings_status"></a>

- `CK_BOOKINGS_STATUS` (source): `CHECK (booking_status IN ('CONFIRMED','CANCELLED','COMPLETED','NO_SHOW'))`
  <a id="ck_bookings_payment_status"></a>
- `CK_BOOKINGS_PAYMENT_STATUS` (source): `CHECK (payment_status IN ('UNPAID','PARTIALLY_PAID','PAID','PARTIALLY_REFUNDED','REFUNDED'))`
  <a id="ck_bookings_source"></a>
- `CK_BOOKINGS_SOURCE` (source): `CHECK (booking_source IN ('ONLINE','WALK_IN','PHONE','WHATSAPP','STAFF'))`
  <a id="ck_bookings_total"></a>
- `CK_BOOKINGS_TOTAL` (source): `CHECK (total_amount >= 0)`
  <a id="ck_bookings_uuid"></a>
- `CK_BOOKINGS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_bookings_currency_code"></a>
- `CK_BOOKINGS_CURRENCY_CODE` (proposed): `CHECK (REGEXP_LIKE(CURRENCY_CODE,'^[A-Z]{3}$','c'))`
  <a id="ck_bookings_id_positive"></a>
- `CK_BOOKINGS_ID_POSITIVE` (proposed): `CHECK (BOOKING_ID>0 AND BOOKING_ID=TRUNC(BOOKING_ID))`
  <a id="ck_booking_preference"></a>
- `CK_BOOKING_PREFERENCE` (proposed): `CHECK (payment_preference IS NULL OR payment_preference IN ('CASH_AT_VENUE','BANK_TRANSFER','CARD_AT_VENUE'))`
  <a id="ck_online_preference"></a>
- `CK_ONLINE_PREFERENCE` (proposed): `CHECK (booking_source<>'ONLINE' OR payment_preference IS NOT NULL)`

### BOOKING_ITEMS

<a id="ck_booking_items_range"></a>

- `CK_BOOKING_ITEMS_RANGE` (source): `CHECK (ends_at_utc > starts_at_utc)`
  <a id="ck_booking_items_duration"></a>
- `CK_BOOKING_ITEMS_DURATION` (source): `CHECK (duration_minutes > 0 AND MOD(duration_minutes,15) = 0 AND (ends_at_utc - starts_at_utc) = NUMTODSINTERVAL(duration_minutes,'MINUTE'))`
  <a id="ck_booking_items_grid"></a>
- `CK_BOOKING_ITEMS_GRID` (source): `CHECK (MOD(EXTRACT(MINUTE FROM starts_at_utc),15) = 0 AND EXTRACT(SECOND FROM starts_at_utc) = 0)`
  <a id="ck_booking_items_amounts"></a>
- `CK_BOOKING_ITEMS_AMOUNTS` (source): `CHECK (hourly_rate_snapshot >= 0 AND line_total >= 0)`
  <a id="ck_booking_items_status"></a>
- `CK_BOOKING_ITEMS_STATUS` (source): `CHECK (item_status IN ('ACTIVE','CANCELLED','COMPLETED'))`
  <a id="ck_booking_items_currency_code"></a>
- `CK_BOOKING_ITEMS_CURRENCY_CODE` (proposed): `CHECK (REGEXP_LIKE(CURRENCY_CODE,'^[A-Z]{3}$','c'))`
  <a id="ck_booking_items_id_positive"></a>
- `CK_BOOKING_ITEMS_ID_POSITIVE` (proposed): `CHECK (BOOKING_ITEM_ID>0 AND BOOKING_ITEM_ID=TRUNC(BOOKING_ITEM_ID))`
  <a id="ck_booking_items_occupancy"></a>
- `CK_BOOKING_ITEMS_OCCUPANCY` (proposed): `CHECK (buffer_before_minutes>=0 AND buffer_after_minutes>=0 AND MOD(buffer_before_minutes,15)=0 AND MOD(buffer_after_minutes,15)=0 AND occupied_start_utc=starts_at_utc-NUMTODSINTERVAL(buffer_before_minutes,'MINUTE') AND occupied_end_utc=ends_at_utc+NUMTODSINTERVAL(buffer_after_minutes,'MINUTE'))`

### RESOURCE_SLOT_RESERVATIONS

<a id="ck_slot_reservations_owner"></a>

- `CK_SLOT_RESERVATIONS_OWNER` (source): `CHECK ((booking_item_id IS NOT NULL AND hold_item_id IS NULL) OR (booking_item_id IS NULL AND hold_item_id IS NOT NULL))`
  <a id="ck_slot_reservations_grid"></a>
- `CK_SLOT_RESERVATIONS_GRID` (source): `CHECK (MOD(EXTRACT(MINUTE FROM slot_start_utc),15) = 0 AND EXTRACT(SECOND FROM slot_start_utc) = 0)`

### BOOKING_CANCELLATIONS

<a id="ck_bc_source"></a>

- `CK_BC_SOURCE` (source): `CHECK (cancellation_source IN ('STAFF','ADMIN','SYSTEM'))`
  <a id="ck_booking_cancellations_id_positive"></a>
- `CK_BOOKING_CANCELLATIONS_ID_POSITIVE` (proposed): `CHECK (CANCELLATION_ID>0 AND CANCELLATION_ID=TRUNC(CANCELLATION_ID))`

### BUSINESS_PAYMENT_SETTINGS

<a id="ck_business_payment_cash"></a>

- `CK_BUSINESS_PAYMENT_CASH` (source): `CHECK (accept_cash IN ('Y','N'))`
  <a id="ck_business_payment_bank"></a>
- `CK_BUSINESS_PAYMENT_BANK` (source): `CHECK (accept_bank_transfer IN ('Y','N'))`
  <a id="ck_business_payment_card"></a>
- `CK_BUSINESS_PAYMENT_CARD` (source): `CHECK (accept_card_at_venue IN ('Y','N'))`
  <a id="ck_business_payment_settings_id_positive"></a>
- `CK_BUSINESS_PAYMENT_SETTINGS_ID_POSITIVE` (proposed): `CHECK (BUSINESS_PAYMENT_SETTINGS_ID>0 AND BUSINESS_PAYMENT_SETTINGS_ID=TRUNC(BUSINESS_PAYMENT_SETTINGS_ID))`

### PAYMENTS

<a id="ck_payments_status"></a>

- `CK_PAYMENTS_STATUS` (source): `CHECK (payment_status IN ('RECEIVED','VOIDED'))`
  <a id="ck_payments_amount"></a>
- `CK_PAYMENTS_AMOUNT` (source): `CHECK (amount > 0)`
  <a id="ck_payments_currency_code"></a>
- `CK_PAYMENTS_CURRENCY_CODE` (proposed): `CHECK (REGEXP_LIKE(CURRENCY_CODE,'^[A-Z]{3}$','c'))`
  <a id="ck_payments_uuid"></a>
- `CK_PAYMENTS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_payments_id_positive"></a>
- `CK_PAYMENTS_ID_POSITIVE` (proposed): `CHECK (PAYMENT_ID>0 AND PAYMENT_ID=TRUNC(PAYMENT_ID))`
  <a id="ck_payments_void"></a>
- `CK_PAYMENTS_VOID` (proposed): `CHECK ((payment_status='RECEIVED' AND voided_at_utc IS NULL AND void_reason IS NULL AND VOIDED_BY_MEMBERSHIP_ID IS NULL) OR (payment_status='VOIDED' AND voided_at_utc IS NOT NULL AND void_reason IS NOT NULL AND VOIDED_BY_MEMBERSHIP_ID IS NOT NULL))`
  <a id="ck_payments_method"></a>
- `CK_PAYMENTS_METHOD` (proposed): `CHECK (payment_method IN ('CASH','BANK_TRANSFER','CARD_AT_VENUE'))`

### REFUNDS

<a id="ck_refunds_amount"></a>

- `CK_REFUNDS_AMOUNT` (source): `CHECK (amount > 0)`
  <a id="ck_refunds_status"></a>
- `CK_REFUNDS_STATUS` (source): `CHECK (refund_status IN ('REQUESTED','PROCESSED','REJECTED'))`
  <a id="ck_refunds_currency_code"></a>
- `CK_REFUNDS_CURRENCY_CODE` (proposed): `CHECK (REGEXP_LIKE(CURRENCY_CODE,'^[A-Z]{3}$','c'))`
  <a id="ck_refunds_uuid"></a>
- `CK_REFUNDS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_refunds_id_positive"></a>
- `CK_REFUNDS_ID_POSITIVE` (proposed): `CHECK (REFUND_ID>0 AND REFUND_ID=TRUNC(REFUND_ID))`
  <a id="ck_refund_processed"></a>
- `CK_REFUND_PROCESSED` (proposed): `CHECK (refund_status<>'PROCESSED' OR processed_at_utc IS NOT NULL)`

### SUBSCRIPTION_PLANS

<a id="ck_subscription_plans_price"></a>

- `CK_SUBSCRIPTION_PLANS_PRICE` (source): `CHECK (price_amount >= 0)`
  <a id="ck_subscription_plans_interval"></a>
- `CK_SUBSCRIPTION_PLANS_INTERVAL` (source): `CHECK (billing_interval IN ('MONTHLY','YEARLY','CUSTOM'))`
  <a id="ck_subscription_plans_trial"></a>
- `CK_SUBSCRIPTION_PLANS_TRIAL` (source): `CHECK (trial_days >= 0)`
  <a id="ck_subscription_plans_active"></a>
- `CK_SUBSCRIPTION_PLANS_ACTIVE` (source): `CHECK (is_active IN ('Y','N'))`
  <a id="ck_subscription_plans_currency_code"></a>
- `CK_SUBSCRIPTION_PLANS_CURRENCY_CODE` (proposed): `CHECK (REGEXP_LIKE(CURRENCY_CODE,'^[A-Z]{3}$','c'))`
  <a id="ck_subscription_plans_id_positive"></a>
- `CK_SUBSCRIPTION_PLANS_ID_POSITIVE` (proposed): `CHECK (PLAN_ID>0 AND PLAN_ID=TRUNC(PLAN_ID))`

### SUBSCRIPTION_ENTITLEMENTS

<a id="ck_se_enabled"></a>

- `CK_SE_ENABLED` (source): `CHECK (is_enabled IN ('Y','N'))`
  <a id="ck_se_limit"></a>
- `CK_SE_LIMIT` (source): `CHECK (limit_value IS NULL OR limit_value >= 0)`

### SUBSCRIPTIONS

<a id="ck_subscriptions_period"></a>

- `CK_SUBSCRIPTIONS_PERIOD` (source): `CHECK (ends_at_utc IS NULL OR ends_at_utc > starts_at_utc)`
  <a id="ck_subscriptions_trial"></a>
- `CK_SUBSCRIPTIONS_TRIAL` (source): `CHECK (trial_ends_at_utc IS NULL OR trial_starts_at_utc IS NULL OR trial_ends_at_utc >= trial_starts_at_utc)`
  <a id="ck_subscriptions_id_positive"></a>
- `CK_SUBSCRIPTIONS_ID_POSITIVE` (proposed): `CHECK (SUBSCRIPTION_ID>0 AND SUBSCRIPTION_ID=TRUNC(SUBSCRIPTION_ID))`
  <a id="ck_subscription_snapshot"></a>
- `CK_SUBSCRIPTION_SNAPSHOT` (proposed): `CHECK (price_amount_snapshot>=0 AND REGEXP_LIKE(currency_code,'^[A-Z]{3}$','c') AND billing_interval_snapshot IN ('MONTHLY','YEARLY','CUSTOM'))`
  <a id="ck_subscriptions_status"></a>
- `CK_SUBSCRIPTIONS_STATUS` (proposed): `CHECK (subscription_status IN ('SCHEDULED','TRIAL','ACTIVE','PAST_DUE','GRACE','SUSPENDED','CANCELLED','EXPIRED'))`
  <a id="ck_subscription_trial_pair"></a>
- `CK_SUBSCRIPTION_TRIAL_PAIR` (proposed): `CHECK ((trial_starts_at_utc IS NULL AND trial_ends_at_utc IS NULL) OR (trial_starts_at_utc IS NOT NULL AND trial_ends_at_utc IS NOT NULL AND trial_ends_at_utc>trial_starts_at_utc))`
  <a id="ck_subscription_trial_state"></a>
- `CK_SUBSCRIPTION_TRIAL_STATE` (proposed): `CHECK (subscription_status<>'TRIAL' OR (trial_starts_at_utc IS NOT NULL AND trial_ends_at_utc IS NOT NULL))`
  <a id="ck_subscription_grace"></a>
- `CK_SUBSCRIPTION_GRACE` (proposed): `CHECK (subscription_status<>'GRACE' OR (grace_ends_at_utc IS NOT NULL AND grace_ends_at_utc>=ends_at_utc))`

### SUBSCRIPTION_INVOICES

<a id="ck_si_amount"></a>

- `CK_SI_AMOUNT` (source): `CHECK (amount_due >= 0)`
  <a id="ck_si_status"></a>
- `CK_SI_STATUS` (source): `CHECK (invoice_status IN ('DRAFT','ISSUED','PAID','OVERDUE','VOID'))`
  <a id="ck_subscription_invoices_currency_code"></a>
- `CK_SUBSCRIPTION_INVOICES_CURRENCY_CODE` (proposed): `CHECK (REGEXP_LIKE(CURRENCY_CODE,'^[A-Z]{3}$','c'))`
  <a id="ck_subscription_invoices_id_positive"></a>
- `CK_SUBSCRIPTION_INVOICES_ID_POSITIVE` (proposed): `CHECK (SUBSCRIPTION_INVOICE_ID>0 AND SUBSCRIPTION_INVOICE_ID=TRUNC(SUBSCRIPTION_INVOICE_ID))`
  <a id="ck_si_period"></a>
- `CK_SI_PERIOD` (proposed): `CHECK (period_ends_at_utc>period_starts_at_utc)`

### SUBSCRIPTION_PAYMENTS

<a id="ck_sp_method"></a>

- `CK_SP_METHOD` (source): `CHECK (payment_method IN ('CASH','BANK_TRANSFER','CARD','OTHER'))`
  <a id="ck_sp_status"></a>
- `CK_SP_STATUS` (source): `CHECK (payment_status IN ('RECEIVED','VOIDED'))`
  <a id="ck_sp_amount"></a>
- `CK_SP_AMOUNT` (source): `CHECK (amount > 0)`
  <a id="ck_subscription_payments_currency_code"></a>
- `CK_SUBSCRIPTION_PAYMENTS_CURRENCY_CODE` (proposed): `CHECK (REGEXP_LIKE(CURRENCY_CODE,'^[A-Z]{3}$','c'))`
  <a id="ck_subscription_payments_uuid"></a>
- `CK_SUBSCRIPTION_PAYMENTS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_subscription_payments_id_positive"></a>
- `CK_SUBSCRIPTION_PAYMENTS_ID_POSITIVE` (proposed): `CHECK (SUBSCRIPTION_PAYMENT_ID>0 AND SUBSCRIPTION_PAYMENT_ID=TRUNC(SUBSCRIPTION_PAYMENT_ID))`
  <a id="ck_subscription_payments_void"></a>
- `CK_SUBSCRIPTION_PAYMENTS_VOID` (proposed): `CHECK ((payment_status='RECEIVED' AND voided_at_utc IS NULL AND void_reason IS NULL AND VOIDED_BY_USER_ID IS NULL) OR (payment_status='VOIDED' AND voided_at_utc IS NOT NULL AND void_reason IS NOT NULL AND VOIDED_BY_USER_ID IS NOT NULL))`

### WEBSITE_THEMES

<a id="ck_website_themes_active"></a>

- `CK_WEBSITE_THEMES_ACTIVE` (source): `CHECK (is_active IN ('Y','N'))`
  <a id="ck_website_themes_id_positive"></a>
- `CK_WEBSITE_THEMES_ID_POSITIVE` (proposed): `CHECK (THEME_ID>0 AND THEME_ID=TRUNC(THEME_ID))`

### WEBSITE_SETTINGS

<a id="ck_website_settings_status"></a>

- `CK_WEBSITE_SETTINGS_STATUS` (source): `CHECK (website_status IN ('DRAFT','PUBLISHED','UNPUBLISHED'))`
  <a id="ck_website_settings_slug"></a>
- `CK_WEBSITE_SETTINGS_SLUG` (source): `CHECK (REGEXP_LIKE(subdomain_slug, '^[a-z0-9]([a-z0-9-]{0,98}[a-z0-9])?$'))`
  <a id="ck_website_settings_uuid"></a>
- `CK_WEBSITE_SETTINGS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_website_settings_id_positive"></a>
- `CK_WEBSITE_SETTINGS_ID_POSITIVE` (proposed): `CHECK (WEBSITE_ID>0 AND WEBSITE_ID=TRUNC(WEBSITE_ID))`
  <a id="ck_website_dns_label"></a>
- `CK_WEBSITE_DNS_LABEL` (proposed): `CHECK (LENGTH(subdomain_slug)<=63)`

### WEBSITE_MEDIA

<a id="ck_website_media_owner"></a>

- `CK_WEBSITE_MEDIA_OWNER` (source): `CHECK (resource_id IS NULL OR location_id IS NOT NULL)`
  <a id="ck_website_media_size"></a>
- `CK_WEBSITE_MEDIA_SIZE` (source): `CHECK (size_bytes > 0)`
  <a id="ck_website_media_kind"></a>
- `CK_WEBSITE_MEDIA_KIND` (source): `CHECK (media_kind IN ('LOGO','COVER','BUSINESS','LOCATION','RESOURCE','OTHER'))`
  <a id="ck_website_media_status"></a>
- `CK_WEBSITE_MEDIA_STATUS` (source): `CHECK (media_status IN ('ACTIVE','ARCHIVED','DELETED'))`
  <a id="ck_website_media_uuid"></a>
- `CK_WEBSITE_MEDIA_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_website_media_id_positive"></a>
- `CK_WEBSITE_MEDIA_ID_POSITIVE` (proposed): `CHECK (WEBSITE_MEDIA_ID>0 AND WEBSITE_MEDIA_ID=TRUNC(WEBSITE_MEDIA_ID))`

### NOTIFICATION_TEMPLATES

<a id="ck_nt_channel"></a>

- `CK_NT_CHANNEL` (source): `CHECK (channel IN ('EMAIL','SMS','WHATSAPP','IN_APP'))`
  <a id="ck_nt_active"></a>
- `CK_NT_ACTIVE` (source): `CHECK (is_active IN ('Y','N'))`
  <a id="ck_notification_templates_id_positive"></a>
- `CK_NOTIFICATION_TEMPLATES_ID_POSITIVE` (proposed): `CHECK (NOTIFICATION_TEMPLATE_ID>0 AND NOTIFICATION_TEMPLATE_ID=TRUNC(NOTIFICATION_TEMPLATE_ID))`
  <a id="ck_template_global_only"></a>
- `CK_TEMPLATE_GLOBAL_ONLY` (proposed): `CHECK (tenant_id IS NULL)`
  <a id="ck_notification_templates_channel"></a>
- `CK_NOTIFICATION_TEMPLATES_CHANNEL` (proposed): `CHECK (channel='EMAIL')`

### NOTIFICATIONS

<a id="ck_notifications_status"></a>

- `CK_NOTIFICATIONS_STATUS` (source): `CHECK (notification_status IN ('QUEUED','SENT','FAILED','CANCELLED'))`
  <a id="ck_notifications_id_positive"></a>
- `CK_NOTIFICATIONS_ID_POSITIVE` (proposed): `CHECK (NOTIFICATION_ID>0 AND NOTIFICATION_ID=TRUNC(NOTIFICATION_ID))`
  <a id="ck_notifications_scope"></a>
- `CK_NOTIFICATIONS_SCOPE` (proposed): `CHECK ((tenant_id IS NULL AND scope_tenant_id=0) OR (tenant_id IS NOT NULL AND scope_tenant_id=tenant_id))`
  <a id="ck_notification_platform"></a>
- `CK_NOTIFICATION_PLATFORM` (proposed): `CHECK (tenant_id IS NOT NULL OR (recipient_user_id IS NOT NULL AND booking_id IS NULL))`
  <a id="ck_notification_booking_scope"></a>
- `CK_NOTIFICATION_BOOKING_SCOPE` (proposed): `CHECK (booking_id IS NULL OR tenant_id IS NOT NULL)`
  <a id="ck_notifications_channel"></a>
- `CK_NOTIFICATIONS_CHANNEL` (proposed): `CHECK (channel='EMAIL')`

### NOTIFICATION_LOGS

<a id="ck_notification_logs_status"></a>

- `CK_NOTIFICATION_LOGS_STATUS` (source): `CHECK (delivery_status IN ('SENT','DELIVERED','FAILED','BOUNCED','UNKNOWN'))`
  <a id="ck_notification_logs_id_positive"></a>
- `CK_NOTIFICATION_LOGS_ID_POSITIVE` (proposed): `CHECK (NOTIFICATION_LOG_ID>0 AND NOTIFICATION_LOG_ID=TRUNC(NOTIFICATION_LOG_ID))`
  <a id="ck_notification_logs_scope"></a>
- `CK_NOTIFICATION_LOGS_SCOPE` (proposed): `CHECK ((tenant_id IS NULL AND scope_tenant_id=0) OR (tenant_id IS NOT NULL AND scope_tenant_id=tenant_id))`
  <a id="ck_notification_attempt"></a>
- `CK_NOTIFICATION_ATTEMPT` (proposed): `CHECK (attempt_number>0)`

### OUTBOX_EVENTS

<a id="ck_outbox_events_status"></a>

- `CK_OUTBOX_EVENTS_STATUS` (source): `CHECK (event_status IN ('PENDING','PROCESSING','PROCESSED','FAILED'))`
  <a id="ck_outbox_events_id_positive"></a>
- `CK_OUTBOX_EVENTS_ID_POSITIVE` (proposed): `CHECK (OUTBOX_EVENT_ID>0 AND OUTBOX_EVENT_ID=TRUNC(OUTBOX_EVENT_ID))`
  <a id="ck_outbox_events_scope"></a>
- `CK_OUTBOX_EVENTS_SCOPE` (proposed): `CHECK ((scope_kind='PLATFORM' AND tenant_id IS NULL) OR (scope_kind='TENANT' AND tenant_id IS NOT NULL))`
  <a id="ck_outbox_attempts"></a>
- `CK_OUTBOX_ATTEMPTS` (proposed): `CHECK (attempt_count>=0 AND max_attempts>0)`
  <a id="ck_outbox_events_payload_version"></a>
- `CK_OUTBOX_EVENTS_PAYLOAD_VERSION` (proposed): `CHECK (payload_version>0)`

### JOB_QUEUE

<a id="ck_job_queue_status"></a>

- `CK_JOB_QUEUE_STATUS` (source): `CHECK (job_status IN ('PENDING','RUNNING','COMPLETED','FAILED','CANCELLED'))`
  <a id="ck_job_queue_attempts"></a>
- `CK_JOB_QUEUE_ATTEMPTS` (source): `CHECK (attempt_count >= 0 AND max_attempts > 0)`
  <a id="ck_job_queue_id_positive"></a>
- `CK_JOB_QUEUE_ID_POSITIVE` (proposed): `CHECK (JOB_ID>0 AND JOB_ID=TRUNC(JOB_ID))`
  <a id="ck_job_queue_scope"></a>
- `CK_JOB_QUEUE_SCOPE` (proposed): `CHECK ((scope_kind='PLATFORM' AND tenant_id IS NULL) OR (scope_kind='TENANT' AND tenant_id IS NOT NULL))`
  <a id="ck_job_queue_payload_version"></a>
- `CK_JOB_QUEUE_PAYLOAD_VERSION` (proposed): `CHECK (payload_version>0)`
  <a id="ck_job_lease"></a>
- `CK_JOB_LEASE` (proposed): `CHECK ((job_status='RUNNING' AND lease_token IS NOT NULL AND lease_expires_at_utc IS NOT NULL AND locked_by IS NOT NULL AND locked_at_utc IS NOT NULL) OR (job_status<>'RUNNING' AND lease_token IS NULL AND lease_expires_at_utc IS NULL AND locked_by IS NULL AND locked_at_utc IS NULL))`

### IDEMPOTENCY_KEYS

<a id="ck_idempotency_keys_request_hash"></a>

- `CK_IDEMPOTENCY_KEYS_REQUEST_HASH` (proposed): `CHECK (REGEXP_LIKE(REQUEST_HASH,'^[0-9a-f]{64}$','c'))`
  <a id="ck_idempotency_keys_id_positive"></a>
- `CK_IDEMPOTENCY_KEYS_ID_POSITIVE` (proposed): `CHECK (IDEMPOTENCY_ID>0 AND IDEMPOTENCY_ID=TRUNC(IDEMPOTENCY_ID))`
  <a id="ck_idem_state"></a>
- `CK_IDEM_STATE` (proposed): `CHECK (owner_type IN ('USER','GUEST') AND execution_status IN ('PROCESSING','COMPLETED','FAILED') AND expires_at_utc>created_at_utc AND REGEXP_LIKE(owner_scope,'^[0-9a-f]{64}$','c'))`
  <a id="ck_idem_lease"></a>
- `CK_IDEM_LEASE` (proposed): `CHECK ((execution_status='PROCESSING' AND lease_token IS NOT NULL AND lease_expires_at_utc IS NOT NULL) OR (execution_status<>'PROCESSING' AND lease_token IS NULL AND lease_expires_at_utc IS NULL))`
  <a id="ck_idem_http_status"></a>
- `CK_IDEM_HTTP_STATUS` (proposed): `CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599)`

### AUDIT_LOGS

<a id="ck_audit_logs_membership"></a>

- `CK_AUDIT_LOGS_MEMBERSHIP` (source): `CHECK (actor_membership_id IS NULL OR (tenant_id IS NOT NULL AND actor_user_id IS NOT NULL))`
  <a id="ck_audit_logs_uuid"></a>
- `CK_AUDIT_LOGS_UUID` (proposed): `CHECK (REGEXP_LIKE(public_id,'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','c'))`
  <a id="ck_audit_logs_id_positive"></a>
- `CK_AUDIT_LOGS_ID_POSITIVE` (proposed): `CHECK (AUDIT_LOG_ID>0 AND AUDIT_LOG_ID=TRUNC(AUDIT_LOG_ID))`
  <a id="ck_audit_logs_scope"></a>
- `CK_AUDIT_LOGS_SCOPE` (proposed): `CHECK ((scope_kind='PLATFORM' AND tenant_id IS NULL) OR (scope_kind='TENANT' AND tenant_id IS NOT NULL))`
  <a id="ck_audit_actor"></a>
- `CK_AUDIT_ACTOR` (proposed): `CHECK ((actor_type='USER' AND actor_user_id IS NOT NULL AND actor_platform_admin_id IS NULL AND actor_service IS NULL AND actor_key IS NULL AND ((tenant_id IS NULL AND actor_membership_id IS NULL) OR (tenant_id IS NOT NULL AND actor_membership_id IS NOT NULL))) OR (actor_type='PLATFORM_ADMIN' AND actor_platform_admin_id IS NOT NULL AND actor_user_id IS NOT NULL AND actor_membership_id IS NULL AND actor_service IS NULL AND actor_key IS NULL) OR (actor_type IN ('WORKER','SYSTEM') AND actor_service IS NOT NULL AND actor_user_id IS NULL AND actor_membership_id IS NULL AND actor_platform_admin_id IS NULL AND actor_key IS NULL) OR (actor_type='GUEST' AND tenant_id IS NOT NULL AND actor_key IS NOT NULL AND actor_user_id IS NULL AND actor_membership_id IS NULL AND actor_platform_admin_id IS NULL AND actor_service IS NULL))`

### ONBOARDING_PROGRESS

<a id="ck_onboarding_status"></a>

- `CK_ONBOARDING_STATUS` (source): `CHECK (step_status IN ('PENDING','IN_PROGRESS','COMPLETED','SKIPPED'))`
  <a id="ck_onboarding_progress_id_positive"></a>
- `CK_ONBOARDING_PROGRESS_ID_POSITIVE` (proposed): `CHECK (ONBOARDING_PROGRESS_ID>0 AND ONBOARDING_PROGRESS_ID=TRUNC(ONBOARDING_PROGRESS_ID))`

### INVITATION_LOCATIONS

### SUBSCRIPTION_FEATURE_SNAPSHOTS

<a id="ck_sfs_values"></a>

- `CK_SFS_VALUES` (proposed): `CHECK (is_enabled IN ('Y','N') AND (limit_value IS NULL OR limit_value>=0))`

## Source deviations and dependencies

Remove source UQ_PLATFORM_ADMINS_ID: it repeats PK_PLATFORM_ADMINS on the same column and is a static DDL risk. New UQ_ADMIN_USER_PAIR is a different key used to prove an admin actor and global user agree. Changed parent currency keys protect booking/payment/refund and subscription invoice/payment currency equality. Public IDs are added only to externally addressable entities plus token-reconstruction records; natural/composite association keys remain intact. All changes are review proposals.

Initial creation follows [migration ordering](migration-strategy.md). TENANT_USERS.inviter is an optional self-FK added after table creation. SCHEMA_MIGRATIONS.REPAIR_VERSION is another explicit optional self-FK; registry verifier forbids repair cycles/chains. All other dependencies are acyclic and parents precede children.

Step 07 explicit delta: tenant-owned ROLES also has UQ_ROLES_TENANT_NAME(TENANT_ID,ROLE_NAME), required by the current prompt. The complete scoped SQL draft is [inventoried separately](implemented-schema.md), is approved under D-18, and is now installed/catalog-verified on Oracle. Application lifecycle transitions/overlap/authorization remain separate from static row checks.

D-18 explicitly approves the Step 07 constraint shapes, including quarter-hour resource duration/buffer checks, segmented/conditional schedule times, holiday activation and tenant-safe identity/access links. Other tables and application transitions remain at their owning-step gates.

23 November 2026: scoped Step 07 constraint definitions are installed and metadata-verified; all 33 actual named-constraint integrity cases passed in the disposable owner. Broader future-table definitions and application transactions retain their gates. [Evidence](step07-verification.md).
