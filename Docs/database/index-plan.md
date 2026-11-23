# Index and query plan

**Proposed / unmeasured.** PK/UK backing indexes are not recreated separately. Rows below are the explicit index plan; key-backed paths are recorded per table. Expression indexes are 19c function-based designs requiring real Oracle validation; no latency/cardinality claims are made. Leading FK coverage is verified statically, but real delete/update locking and plans still need Oracle tests.

Important query predicates: tenant/member lookup uses tenant-user unique plus user/status; calendar uses tenant/resource/start and interval overlap residual end; slots use PK tenant/resource/slot range; holds have both tenant expiry and global expiry-worker indexes; customer exact mobile/email lookup is tenant-first, name substring/fuzzy search is not claimed to use these B-trees. Venue receipts reconcile tenant/booking/time, subscription expiry scans status/end globally, hostname resolves unique subdomain, jobs/outbox use status/due/id globally and tenant views separately, audit history is tenant/actor/time.

Do not infer that every prefix index is redundant: covering/order/filter shapes differ. Exact duplicates of key-backed indexes below are omitted. Review narrow-prefix overlaps under workload before retaining extra write cost. Foreign keys to global parents may intentionally have global leading IDs; user-visible business queries still require tenant filters.

## Source indexes omitted

- `IX_HOLIDAYS_LOCATION_DATE` on `HOLIDAYS`: Exact key already supported by PK/UK; omit duplicate explicit index.

Source `UQ_PLATFORM_ADMINS_ID` also duplicates the PK and is removed from the proposed constraint register. No original SQL is changed.

## SCHEMA_MIGRATIONS

| Name                               | Unique | Ordered columns / expression | Query purpose                                                                                 | Origin   |
| ---------------------------------- | ------ | ---------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `PK_SCHEMA_MIGRATIONS` backing key | Y      | `VERSION`                    | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `IX_FK_MIGRATION_REPAIR`           | N      | `REPAIR_VERSION`             | FK child lookup/parent maintenance using the exact leading relationship columns               | proposed |

## TENANTS

| Name                               | Unique | Ordered columns / expression | Query purpose                                                                                           | Origin |
| ---------------------------------- | ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------- | ------ |
| `PK_TENANTS` backing key           | Y      | `TENANT_ID`                  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source |
| `UQ_TENANTS_PUBLIC_ID` backing key | Y      | `PUBLIC_ID`                  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source |
| `UQ_TENANTS_CODE` backing key      | Y      | `TENANT_CODE`                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source |
| `IX_TENANTS_STATUS`                | N      | `status`                     | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source |

## USERS

| Name                                    | Unique | Ordered columns / expression | Query purpose                                                                                           | Origin |
| --------------------------------------- | ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------- | ------ |
| `PK_USERS` backing key                  | Y      | `USER_ID`                    | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source |
| `UQ_USERS_PUBLIC_ID` backing key        | Y      | `PUBLIC_ID`                  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source |
| `UQ_USERS_EMAIL_NORMALIZED` backing key | Y      | `EMAIL_NORMALIZED`           | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source |
| `IX_USERS_MOBILE`                       | N      | `mobile_e164`                | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source |

## PLATFORM_SETTINGS

| Name                               | Unique | Ordered columns / expression | Query purpose                                                                                 | Origin |
| ---------------------------------- | ------ | ---------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| `PK_PLATFORM_SETTINGS` backing key | Y      | `SETTING_KEY`                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |

## TENANT_USERS

| Name                                      | Unique | Ordered columns / expression          | Query purpose                                                                                           | Origin   |
| ----------------------------------------- | ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| `PK_TENANT_USERS` backing key             | Y      | `MEMBERSHIP_ID`                       | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_TU_TENANT_MEMBER` backing key         | Y      | `TENANT_ID, MEMBERSHIP_ID`            | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_TU_TENANT_MEMBER_USER` backing key    | Y      | `TENANT_ID, MEMBERSHIP_ID, USER_ID`   | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_TENANT_USERS_TENANT_USER` backing key | Y      | `TENANT_ID, USER_ID`                  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_TENANT_USERS_PUBLIC_ID` backing key   | Y      | `TENANT_ID, PUBLIC_ID`                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | proposed |
| `IX_TENANT_USERS_USER`                    | N      | `user_id, membership_status`          | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source   |
| `IX_TENANT_USERS_INVITER`                 | N      | `tenant_id, invited_by_membership_id` | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source   |

## AUTH_SESSIONS

| Name                                 | Unique | Ordered columns / expression                    | Query purpose                                                                                           | Origin   |
| ------------------------------------ | ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| `PK_AUTH_SESSIONS` backing key       | Y      | `SESSION_ID`                                    | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_AUTH_SESSIONS_TOKEN` backing key | Y      | `TOKEN_HASH`                                    | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `IX_AUTH_SESSIONS_USER_EXPIRY`       | N      | `user_id, expires_at_utc`                       | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source   |
| `IX_FK_SESSION_ACTIVE_MEMBER`        | N      | `ACTIVE_TENANT_ID,ACTIVE_MEMBERSHIP_ID,USER_ID` | FK child lookup/parent maintenance using the exact leading relationship columns                         | proposed |

## EMAIL_VERIFICATION_TOKENS

| Name                                              | Unique | Ordered columns / expression | Query purpose                                                                                           | Origin   |
| ------------------------------------------------- | ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| `PK_EMAIL_VERIFICATION_TOKENS` backing key        | Y      | `VERIFICATION_ID`            | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_EMAIL_VERIFICATION_TOKEN` backing key         | Y      | `TOKEN_HASH`                 | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_EMAIL_VERIFICATION_TOKENS_PUBLIC` backing key | Y      | `PUBLIC_ID`                  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | proposed |
| `IX_EMAIL_VERIFICATION_USER`                      | N      | `user_id, expires_at_utc`    | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source   |

## PASSWORD_RESET_TOKENS

| Name                                          | Unique | Ordered columns / expression | Query purpose                                                                                           | Origin   |
| --------------------------------------------- | ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| `PK_PASSWORD_RESET_TOKENS` backing key        | Y      | `RESET_ID`                   | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_PASSWORD_RESET_TOKEN` backing key         | Y      | `TOKEN_HASH`                 | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_PASSWORD_RESET_TOKENS_PUBLIC` backing key | Y      | `PUBLIC_ID`                  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | proposed |
| `IX_PASSWORD_RESET_USER`                      | N      | `user_id, expires_at_utc`    | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source   |

## PLATFORM_ADMINS

| Name                                  | Unique | Ordered columns / expression | Query purpose                                                                                 | Origin   |
| ------------------------------------- | ------ | ---------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `PK_PLATFORM_ADMINS` backing key      | Y      | `PLATFORM_ADMIN_ID`          | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_PLATFORM_ADMINS_USER` backing key | Y      | `USER_ID`                    | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_ADMIN_USER_PAIR` backing key      | Y      | `PLATFORM_ADMIN_ID, USER_ID` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |

## ROLES

| Name                               | Unique | Ordered columns / expression | Query purpose                                                                                 | Origin              |
| ---------------------------------- | ------ | ---------------------------- | --------------------------------------------------------------------------------------------- | ------------------- |
| `PK_ROLES` backing key             | Y      | `ROLE_ID`                    | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source              |
| `UQ_ROLES_TENANT_ROLE` backing key | Y      | `TENANT_ID, ROLE_ID`         | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source              |
| `UQ_ROLES_TENANT_CODE` backing key | Y      | `TENANT_ID, ROLE_CODE`       | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source              |
| `UQ_ROLES_TENANT_NAME` backing key | Y      | `TENANT_ID, ROLE_NAME`       | Step 07 requires tenant-scoped display-name uniqueness; no redundant explicit index.          | Step 07 requirement |

## PERMISSIONS

| Name                              | Unique | Ordered columns / expression | Query purpose                                                                                 | Origin |
| --------------------------------- | ------ | ---------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| `PK_PERMISSIONS` backing key      | Y      | `PERMISSION_ID`              | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |
| `UQ_PERMISSIONS_CODE` backing key | Y      | `PERMISSION_CODE`            | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |

## ROLE_PERMISSIONS

| Name                              | Unique | Ordered columns / expression        | Query purpose                                                                                           | Origin |
| --------------------------------- | ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------- | ------ |
| `PK_ROLE_PERMISSIONS` backing key | Y      | `TENANT_ID, ROLE_ID, PERMISSION_ID` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source |
| `IX_ROLE_PERMISSIONS_PERMISSION`  | N      | `permission_id`                     | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source |

## USER_ROLES

| Name                        | Unique | Ordered columns / expression          | Query purpose                                                                                           | Origin   |
| --------------------------- | ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| `PK_USER_ROLES` backing key | Y      | `TENANT_ID, MEMBERSHIP_ID, ROLE_ID`   | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `IX_USER_ROLES_ROLE`        | N      | `tenant_id, role_id`                  | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source   |
| `IX_FK_USER_ROLES_ASSIGNER` | N      | `TENANT_ID,ASSIGNED_BY_MEMBERSHIP_ID` | FK child lookup/parent maintenance using the exact leading relationship columns                         | proposed |

## TENANT_INVITATIONS

| Name                                          | Unique | Ordered columns / expression                     | Query purpose                                                                                           | Origin   |
| --------------------------------------------- | ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------- |
| `PK_TENANT_INVITATIONS` backing key           | Y      | `INVITATION_ID`                                  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_TENANT_INVITATIONS_TOKEN` backing key     | Y      | `TOKEN_HASH`                                     | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_INV_TENANT_ID` backing key                | Y      | `TENANT_ID, INVITATION_ID`                       | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_TENANT_INVITATIONS_PUBLIC_ID` backing key | Y      | `TENANT_ID, PUBLIC_ID`                           | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | proposed |
| `IX_TENANT_INVITATIONS_EMAIL`                 | N      | `tenant_id, email_normalized, invitation_status` | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source   |
| `IX_TENANT_INVITATIONS_EXPIRY`                | N      | `tenant_id, invitation_status, expires_at_utc`   | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source   |
| `IX_TENANT_INVITATIONS_ROLE`                  | N      | `tenant_id, role_id, invitation_status`          | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source   |
| `IX_TENANT_INVITATIONS_INVITER`               | N      | `tenant_id, invited_by_membership_id`            | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source   |

## BUSINESSES

| Name                                       | Unique | Ordered columns / expression | Query purpose                                                                                 | Origin   |
| ------------------------------------------ | ------ | ---------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `PK_BUSINESSES` backing key                | Y      | `BUSINESS_ID`                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_BUSINESSES_TENANT_ID` backing key      | Y      | `TENANT_ID, BUSINESS_ID`     | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_BUSINESSES_ONE_PER_TENANT` backing key | Y      | `TENANT_ID`                  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_BUSINESSES_SLUG` backing key           | Y      | `BUSINESS_SLUG`              | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_BUSINESSES_PUBLIC_ID` backing key      | Y      | `TENANT_ID, PUBLIC_ID`       | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |

## BUSINESS_PROFILES

| Name                                        | Unique | Ordered columns / expression | Query purpose                                                                                 | Origin |
| ------------------------------------------- | ------ | ---------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| `PK_BUSINESS_PROFILES` backing key          | Y      | `BUSINESS_PROFILE_ID`        | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |
| `UQ_BUSINESS_PROFILES_BUSINESS` backing key | Y      | `TENANT_ID, BUSINESS_ID`     | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |

## LOCATIONS

| Name                                         | Unique | Ordered columns / expression            | Query purpose                                                                                 | Origin   |
| -------------------------------------------- | ------ | --------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `PK_LOCATIONS` backing key                   | Y      | `LOCATION_ID`                           | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_LOCATIONS_TENANT_ID` backing key         | Y      | `TENANT_ID, LOCATION_ID`                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_LOCATIONS_BUSINESS_LOCATION` backing key | Y      | `TENANT_ID, BUSINESS_ID, LOCATION_ID`   | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_LOCATIONS_BUSINESS_CODE` backing key     | Y      | `TENANT_ID, BUSINESS_ID, LOCATION_CODE` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_LOCATIONS_PUBLIC_ID` backing key         | Y      | `TENANT_ID, PUBLIC_ID`                  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |
| `IX_LOCATIONS_TENANT`                        | N      | `tenant_id, location_status`            | Tenant/location/resource availability configuration and effective-price interval lookup.      | source   |

## STAFF_ASSIGNMENTS

| Name                                         | Unique | Ordered columns / expression                  | Query purpose                                                                                           | Origin   |
| -------------------------------------------- | ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| `PK_STAFF_ASSIGNMENTS` backing key           | Y      | `STAFF_ASSIGNMENT_ID`                         | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_STAFF_ASSIGNMENTS_TENANT_ID` backing key | Y      | `TENANT_ID, STAFF_ASSIGNMENT_ID`              | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_STAFF_MEMBER_LOC` backing key            | Y      | `TENANT_ID, MEMBERSHIP_ID, LOCATION_ID`       | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | source   |
| `UQ_STAFF_ASSIGNMENTS_PUBLIC_ID` backing key | Y      | `TENANT_ID, PUBLIC_ID`                        | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.           | proposed |
| `IX_STAFF_MEMBERSHIP`                        | N      | `tenant_id, membership_id, assignment_status` | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source   |
| `IX_STAFF_ASSIGNMENTS_LOCATION`              | N      | `tenant_id, location_id, assignment_status`   | Membership/role/invitation lookup or expiry cleanup; global user/session parent access where specified. | source   |

## SPORTS

| Name                         | Unique | Ordered columns / expression | Query purpose                                                                                 | Origin |
| ---------------------------- | ------ | ---------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| `PK_SPORTS` backing key      | Y      | `SPORT_ID`                   | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |
| `UQ_SPORTS_CODE` backing key | Y      | `SPORT_CODE`                 | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |

## BUSINESS_SPORTS

| Name                             | Unique | Ordered columns / expression       | Query purpose                                                                                 | Origin |
| -------------------------------- | ------ | ---------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| `PK_BUSINESS_SPORTS` backing key | Y      | `TENANT_ID, BUSINESS_ID, SPORT_ID` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |
| `IX_BUSINESS_SPORTS_SPORT`       | N      | `sport_id, status`                 | Tenant/location/resource availability configuration and effective-price interval lookup.      | source |

## RESOURCES

| Name                                     | Unique | Ordered columns / expression                       | Query purpose                                                                                 | Origin   |
| ---------------------------------------- | ------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `PK_RESOURCES` backing key               | Y      | `RESOURCE_ID`                                      | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_RESOURCES_TENANT_ID` backing key     | Y      | `TENANT_ID, RESOURCE_ID`                           | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_RES_TENANT_LOC_ID` backing key       | Y      | `TENANT_ID, LOCATION_ID, RESOURCE_ID`              | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_RES_BIZ_LOC_ID` backing key          | Y      | `TENANT_ID, BUSINESS_ID, LOCATION_ID, RESOURCE_ID` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_RESOURCES_LOCATION_CODE` backing key | Y      | `TENANT_ID, LOCATION_ID, RESOURCE_CODE`            | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_RESOURCES_PUBLIC_ID` backing key     | Y      | `TENANT_ID, PUBLIC_ID`                             | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |
| `IX_RESOURCES_TENANT_LOCATION`           | N      | `tenant_id, location_id, resource_status`          | Tenant/location/resource availability configuration and effective-price interval lookup.      | source   |
| `IX_RESOURCES_TENANT_SPORT`              | N      | `tenant_id, sport_id, resource_status`             | Tenant/location/resource availability configuration and effective-price interval lookup.      | source   |
| `IX_FK_RESOURCES_BUSINESS_SPORT`         | N      | `TENANT_ID,BUSINESS_ID,SPORT_ID`                   | FK child lookup/parent maintenance using the exact leading relationship columns               | proposed |

## RESOURCE_FEATURES

| Name                                         | Unique | Ordered columns / expression           | Query purpose                                                                                 | Origin |
| -------------------------------------------- | ------ | -------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| `PK_RESOURCE_FEATURES` backing key           | Y      | `RESOURCE_FEATURE_ID`                  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |
| `UQ_RESOURCE_FEATURES_TENANT_ID` backing key | Y      | `TENANT_ID, RESOURCE_FEATURE_ID`       | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |
| `UQ_RESOURCE_FEATURES_CODE` backing key      | Y      | `TENANT_ID, RESOURCE_ID, FEATURE_CODE` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |

## OPERATING_HOURS

| Name                                       | Unique | Ordered columns / expression                                   | Query purpose                                                                                 | Origin   |
| ------------------------------------------ | ------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `PK_OPERATING_HOURS` backing key           | Y      | `OPERATING_HOUR_ID`                                            | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_OPERATING_HOURS_TENANT_ID` backing key | Y      | `TENANT_ID, OPERATING_HOUR_ID`                                 | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_OPERATING_HOURS_PUBLIC_ID` backing key | Y      | `TENANT_ID, PUBLIC_ID`                                         | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |
| `UQ_OPERATING_HOURS_SEGMENT` backing key   | Y      | `TENANT_ID, LOCATION_ID, RESOURCE_ID, DAY_OF_WEEK, SEGMENT_NO` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |
| `IX_OPERATING_HOURS_LOCATION`              | N      | `tenant_id, location_id, day_of_week`                          | Tenant/location/resource availability configuration and effective-price interval lookup.      | source   |

## HOLIDAYS

| Name                                    | Unique | Ordered columns / expression           | Query purpose                                                                                 | Origin   |
| --------------------------------------- | ------ | -------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `PK_HOLIDAYS` backing key               | Y      | `HOLIDAY_ID`                           | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_HOLIDAYS_TENANT_ID` backing key     | Y      | `TENANT_ID, HOLIDAY_ID`                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_HOLIDAYS_LOCATION_DATE` backing key | Y      | `TENANT_ID, LOCATION_ID, HOLIDAY_DATE` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_HOLIDAYS_PUBLIC_ID` backing key     | Y      | `TENANT_ID, PUBLIC_ID`                 | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |

## AVAILABILITY_BLOCKS

| Name                                           | Unique | Ordered columns / expression                                       | Query purpose                                                                                 | Origin   |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | -------- |
| `PK_AVAILABILITY_BLOCKS` backing key           | Y      | `AVAILABILITY_BLOCK_ID`                                            | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_AVAIL_BLK_TENANT_ID` backing key           | Y      | `TENANT_ID, AVAILABILITY_BLOCK_ID`                                 | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_AVAILABILITY_BLOCKS_PUBLIC_ID` backing key | Y      | `TENANT_ID, PUBLIC_ID`                                             | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |
| `IX_AVAIL_RESOURCE_TIME`                       | N      | `tenant_id, resource_id, starts_at_utc, ends_at_utc, block_status` | Tenant/location/resource availability configuration and effective-price interval lookup.      | source   |
| `IX_AVAIL_LOCATION_TIME`                       | N      | `tenant_id, location_id, starts_at_utc, ends_at_utc, block_status` | Tenant/location/resource availability configuration and effective-price interval lookup.      | source   |
| `IX_FK_AVAIL_RESOURCE`                         | N      | `TENANT_ID,LOCATION_ID,RESOURCE_ID`                                | FK child lookup/parent maintenance using the exact leading relationship columns               | proposed |
| `IX_FK_AVAILABILITY_BLOCKS_CREATOR`            | N      | `TENANT_ID,CREATED_BY_MEMBERSHIP_ID`                               | FK child lookup/parent maintenance using the exact leading relationship columns               | proposed |

## PRICING_RULES

| Name                                     | Unique | Ordered columns / expression                                                | Query purpose                                                                                 | Origin   |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `PK_PRICING_RULES` backing key           | Y      | `PRICING_RULE_ID`                                                           | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_PRICING_RULES_TENANT_ID` backing key | Y      | `TENANT_ID, PRICING_RULE_ID`                                                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_PRICING_RULES_CODE` backing key      | Y      | `TENANT_ID, RESOURCE_ID, RULE_CODE`                                         | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_PRICING_RULES_PUBLIC_ID` backing key | Y      | `TENANT_ID, PUBLIC_ID`                                                      | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |
| `UQ_PRICE_RESOURCE_KEY` backing key      | Y      | `TENANT_ID, RESOURCE_ID, PRICING_RULE_ID`                                   | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |
| `IX_PRICING_RULES_LOOKUP`                | N      | `tenant_id, resource_id, rule_status, effective_from_utc, effective_to_utc` | Tenant/location/resource availability configuration and effective-price interval lookup.      | source   |

## CUSTOMERS

| Name                                 | Unique | Ordered columns / expression  | Query purpose                                                                                                 | Origin   |
| ------------------------------------ | ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| `PK_CUSTOMERS` backing key           | Y      | `CUSTOMER_ID`                 | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_CUSTOMERS_TENANT_ID` backing key | Y      | `TENANT_ID, CUSTOMER_ID`      | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_CUSTOMERS_PUBLIC` backing key    | Y      | `TENANT_ID, PUBLIC_ID`        | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `IX_CUSTOMERS_TENANT_MOBILE`         | N      | `tenant_id, mobile_e164`      | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `IX_CUSTOMERS_TENANT_EMAIL`          | N      | `tenant_id, email_normalized` | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `IX_CUSTOMERS_TENANT_USER`           | N      | `tenant_id, user_id`          | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `IX_FK_CUSTOMERS_USER`               | N      | `USER_ID`                     | FK child lookup/parent maintenance using the exact leading relationship columns                               | proposed |

## BOOKING_HOLDS

| Name                                     | Unique | Ordered columns / expression             | Query purpose                                                                                                 | Origin   |
| ---------------------------------------- | ------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| `PK_BOOKING_HOLDS` backing key           | Y      | `HOLD_ID`                                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_BOOKING_HOLDS_TENANT_ID` backing key | Y      | `TENANT_ID, HOLD_ID`                     | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_BOOKING_HOLDS_PUBLIC` backing key    | Y      | `TENANT_ID, PUBLIC_ID`                   | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_BOOKING_HOLDS_TOKEN` backing key     | Y      | `HOLD_TOKEN_HASH`                        | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `IX_BOOKING_HOLDS_EXPIRY`                | N      | `tenant_id, hold_status, expires_at_utc` | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `IX_HOLDS_GLOBAL_EXPIRY`                 | N      | `HOLD_STATUS,EXPIRES_AT_UTC,HOLD_ID`     | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | proposed |

## BOOKING_HOLD_ITEMS

| Name                                | Unique | Ordered columns / expression                         | Query purpose                                                                                                 | Origin   |
| ----------------------------------- | ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| `PK_BOOKING_HOLD_ITEMS` backing key | Y      | `HOLD_ITEM_ID`                                       | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_BHI_TENANT_ID` backing key      | Y      | `TENANT_ID, HOLD_ITEM_ID`                            | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_BHI_RESOURCE` backing key       | Y      | `TENANT_ID, HOLD_ITEM_ID, RESOURCE_ID`               | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `IX_BOOKING_HOLD_ITEMS_HOLD`        | N      | `tenant_id, hold_id`                                 | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `IX_BHI_RESOURCE_TIME`              | N      | `tenant_id, resource_id, starts_at_utc, ends_at_utc` | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `IX_FK_BOOKING_HOLD_ITEMS_RESOURCE` | N      | `TENANT_ID,BUSINESS_ID,LOCATION_ID,RESOURCE_ID`      | FK child lookup/parent maintenance using the exact leading relationship columns                               | proposed |
| `IX_FK_BOOKING_HOLD_ITEMS_PRICE`    | N      | `TENANT_ID,RESOURCE_ID,PRICING_RULE_ID`              | FK child lookup/parent maintenance using the exact leading relationship columns                               | proposed |

## BOOKINGS

| Name                                   | Unique | Ordered columns / expression                                                                                            | Query purpose                                                                                                 | Origin   |
| -------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| `PK_BOOKINGS` backing key              | Y      | `BOOKING_ID`                                                                                                            | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_BOOKINGS_TENANT_ID` backing key    | Y      | `TENANT_ID, BOOKING_ID`                                                                                                 | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_BOOKINGS_REFERENCE` backing key    | Y      | `TENANT_ID, BOOKING_REFERENCE`                                                                                          | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_BOOKINGS_BUSINESS_KEY` backing key | Y      | `TENANT_ID, BOOKING_ID, BUSINESS_ID`                                                                                    | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_BOOKINGS_CUSTOMER_KEY` backing key | Y      | `TENANT_ID, BOOKING_ID, CUSTOMER_ID`                                                                                    | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_BOOKINGS_PUBLIC` backing key       | Y      | `TENANT_ID, PUBLIC_ID`                                                                                                  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_BOOKING_CURRENCY` backing key      | Y      | `TENANT_ID, BOOKING_ID, CURRENCY_CODE`                                                                                  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | proposed |
| `IX_BOOKINGS_TENANT_STATUS`            | N      | `tenant_id, booking_status, created_at_utc`                                                                             | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `IX_BOOKINGS_PAYMENT_STATUS`           | N      | `tenant_id, payment_status, created_at_utc`                                                                             | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `IX_BOOKINGS_TENANT_CUSTOMER`          | N      | `tenant_id, customer_id, created_at_utc`                                                                                | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `IX_BOOKINGS_TENANT_BUSINESS`          | N      | `tenant_id, business_id, created_at_utc`                                                                                | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `UX_BOOKINGS_SOURCE_HOLD`              | Y      | `CASE WHEN source_hold_id IS NOT NULL THEN tenant_id END, CASE WHEN source_hold_id IS NOT NULL THEN source_hold_id END` | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `IX_BOOKINGS_CREATOR`                  | N      | `tenant_id, created_by_membership_id, created_at_utc`                                                                   | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `IX_FK_BOOKINGS_HOLD`                  | N      | `TENANT_ID,SOURCE_HOLD_ID`                                                                                              | FK child lookup/parent maintenance using the exact leading relationship columns                               | proposed |

## BOOKING_ITEMS

| Name                                     | Unique | Ordered columns / expression                         | Query purpose                                                                                                 | Origin   |
| ---------------------------------------- | ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| `PK_BOOKING_ITEMS` backing key           | Y      | `BOOKING_ITEM_ID`                                    | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_BOOKING_ITEMS_TENANT_ID` backing key | Y      | `TENANT_ID, BOOKING_ITEM_ID`                         | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `UQ_BI_RESOURCE` backing key             | Y      | `TENANT_ID, BOOKING_ITEM_ID, RESOURCE_ID`            | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `IX_BOOKING_ITEMS_RESOURCE_TIME`         | N      | `tenant_id, resource_id, starts_at_utc, ends_at_utc` | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `IX_BOOKING_ITEMS_BOOKING`               | N      | `tenant_id, booking_id`                              | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `IX_BOOKING_ITEMS_LOCATION_TIME`         | N      | `tenant_id, location_id, starts_at_utc`              | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source   |
| `IX_FK_BOOKING_ITEMS_BOOKING`            | N      | `TENANT_ID,BOOKING_ID,BUSINESS_ID`                   | FK child lookup/parent maintenance using the exact leading relationship columns                               | proposed |
| `IX_FK_BOOKING_ITEMS_RESOURCE`           | N      | `TENANT_ID,BUSINESS_ID,LOCATION_ID,RESOURCE_ID`      | FK child lookup/parent maintenance using the exact leading relationship columns                               | proposed |
| `IX_FK_BOOKING_ITEMS_PRICE`              | N      | `TENANT_ID,RESOURCE_ID,PRICING_RULE_ID`              | FK child lookup/parent maintenance using the exact leading relationship columns                               | proposed |
| `IX_FK_BI_CURRENCY`                      | N      | `TENANT_ID,BOOKING_ID,CURRENCY_CODE`                 | FK child lookup/parent maintenance using the exact leading relationship columns                               | proposed |

## RESOURCE_SLOT_RESERVATIONS

| Name                                        | Unique | Ordered columns / expression              | Query purpose                                                                                                 | Origin   |
| ------------------------------------------- | ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| `PK_RESOURCE_SLOT_RESERVATIONS` backing key | Y      | `TENANT_ID, RESOURCE_ID, SLOT_START_UTC`  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source   |
| `IX_SLOT_RESERVATIONS_BOOKING`              | N      | `tenant_id, booking_item_id, resource_id` | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | proposed |
| `IX_SLOT_RESERVATIONS_HOLD`                 | N      | `tenant_id, hold_item_id, resource_id`    | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | proposed |

## BOOKING_CANCELLATIONS

| Name                                   | Unique | Ordered columns / expression                              | Query purpose                                                                                                 | Origin |
| -------------------------------------- | ------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------ |
| `PK_BOOKING_CANCELLATIONS` backing key | Y      | `CANCELLATION_ID`                                         | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source |
| `UQ_BC_TENANT_ID` backing key          | Y      | `TENANT_ID, CANCELLATION_ID`                              | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source |
| `UQ_BC_BOOKING` backing key            | Y      | `TENANT_ID, BOOKING_ID`                                   | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                 | source |
| `IX_BC_BOOKING`                        | N      | `tenant_id, booking_id, cancelled_at_utc`                 | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source |
| `IX_BOOKING_CANCELLATIONS_ACTOR`       | N      | `tenant_id, cancelled_by_membership_id, cancelled_at_utc` | Tenant calendar/customer/header lookup or owner-slot release; equality columns first, time range/order after. | source |

## BUSINESS_PAYMENT_SETTINGS

| Name                                       | Unique | Ordered columns / expression   | Query purpose                                                                                 | Origin |
| ------------------------------------------ | ------ | ------------------------------ | --------------------------------------------------------------------------------------------- | ------ |
| `PK_BUSINESS_PAYMENT_SETTINGS` backing key | Y      | `BUSINESS_PAYMENT_SETTINGS_ID` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |
| `UQ_BPS_BUSINESS` backing key              | Y      | `TENANT_ID, BUSINESS_ID`       | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |

## PAYMENTS

| Name                                | Unique | Ordered columns / expression                                                                                          | Query purpose                                                                                             | Origin   |
| ----------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| `PK_PAYMENTS` backing key           | Y      | `PAYMENT_ID`                                                                                                          | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.             | source   |
| `UQ_PAYMENTS_TENANT_ID` backing key | Y      | `TENANT_ID, PAYMENT_ID`                                                                                               | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.             | source   |
| `UQ_PAYMENTS_PUBLIC_ID` backing key | Y      | `TENANT_ID, PUBLIC_ID`                                                                                                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.             | proposed |
| `UQ_PAYMENT_CURRENCY` backing key   | Y      | `TENANT_ID, PAYMENT_ID, CURRENCY_CODE`                                                                                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.             | proposed |
| `IX_PAYMENTS_BOOKING`               | N      | `tenant_id, booking_id, received_at_utc`                                                                              | Tenant booking receipt/refund reconciliation and actor history.                                           | source   |
| `IX_PAYMENTS_RECORDER`              | N      | `tenant_id, recorded_by_membership_id, received_at_utc`                                                               | Tenant booking receipt/refund reconciliation and actor history.                                           | source   |
| `IX_FK_PAYMENTS_BOOKING`            | N      | `TENANT_ID,BOOKING_ID,CURRENCY_CODE`                                                                                  | FK child lookup/parent maintenance using the exact leading relationship columns                           | proposed |
| `IX_FK_PAYMENT_VOID_ACTOR`          | N      | `TENANT_ID,VOIDED_BY_MEMBERSHIP_ID`                                                                                   | FK child lookup/parent maintenance using the exact leading relationship columns                           | proposed |
| `UX_PAYMENTS_POSTED_BOOKING`        | Y      | `CASE WHEN PAYMENT_STATUS = 'RECEIVED' THEN TENANT_ID END, CASE WHEN PAYMENT_STATUS = 'RECEIVED' THEN BOOKING_ID END` | D-21: at most one effective posted receipt per booking; voided history is excluded from both expressions. | approved |

## REFUNDS

| Name                               | Unique | Ordered columns / expression                                                                                          | Query purpose                                                                                        | Origin   |
| ---------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------- |
| `PK_REFUNDS` backing key           | Y      | `REFUND_ID`                                                                                                           | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.        | source   |
| `UQ_REFUNDS_TENANT_ID` backing key | Y      | `TENANT_ID, REFUND_ID`                                                                                                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.        | source   |
| `UQ_REFUNDS_PUBLIC_ID` backing key | Y      | `TENANT_ID, PUBLIC_ID`                                                                                                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.        | proposed |
| `IX_REFUNDS_PAYMENT`               | N      | `tenant_id, payment_id`                                                                                               | Tenant booking receipt/refund reconciliation and actor history.                                      | source   |
| `IX_REFUNDS_RECORDER`              | N      | `tenant_id, recorded_by_membership_id, created_at_utc`                                                                | Tenant booking receipt/refund reconciliation and actor history.                                      | source   |
| `IX_FK_REFUNDS_PAYMENT`            | N      | `TENANT_ID,PAYMENT_ID,CURRENCY_CODE`                                                                                  | FK child lookup/parent maintenance using the exact leading relationship columns                      | proposed |
| `UX_REFUNDS_PROCESSED_PAYMENT`     | Y      | `CASE WHEN REFUND_STATUS = 'PROCESSED' THEN TENANT_ID END, CASE WHEN REFUND_STATUS = 'PROCESSED' THEN PAYMENT_ID END` | D-21: at most one completed full refund per payment; dormant requested/rejected history is excluded. | approved |

## SUBSCRIPTION_PLANS

| Name                                     | Unique | Ordered columns / expression | Query purpose                                                                                 | Origin |
| ---------------------------------------- | ------ | ---------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| `PK_SUBSCRIPTION_PLANS` backing key      | Y      | `PLAN_ID`                    | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |
| `UQ_SUBSCRIPTION_PLANS_CODE` backing key | Y      | `PLAN_CODE`                  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |

## SUBSCRIPTION_ENTITLEMENTS

| Name                                       | Unique | Ordered columns / expression | Query purpose                                                                                 | Origin |
| ------------------------------------------ | ------ | ---------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| `PK_SUBSCRIPTION_ENTITLEMENTS` backing key | Y      | `PLAN_ID, FEATURE_CODE`      | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |

## SUBSCRIPTIONS

| Name                                     | Unique | Ordered columns / expression                                                                            | Query purpose                                                                                 | Origin   |
| ---------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `PK_SUBSCRIPTIONS` backing key           | Y      | `SUBSCRIPTION_ID`                                                                                       | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_SUBSCRIPTIONS_TENANT_ID` backing key | Y      | `TENANT_ID, SUBSCRIPTION_ID`                                                                            | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_SUBSCRIPTION_CURRENCY` backing key   | Y      | `TENANT_ID, SUBSCRIPTION_ID, CURRENCY_CODE`                                                             | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |
| `IX_SUBSCRIPTIONS_TENANT_STATUS`         | N      | `tenant_id, subscription_status`                                                                        | Tenant invoice/payment reconciliation or global subscription status/effective-date scan.      | source   |
| `IX_SUBSCRIPTIONS_STATUS_END`            | N      | `subscription_status, ends_at_utc`                                                                      | Tenant invoice/payment reconciliation or global subscription status/effective-date scan.      | source   |
| `IX_SUBSCRIPTIONS_PLAN`                  | N      | `plan_id, subscription_status`                                                                          | Tenant invoice/payment reconciliation or global subscription status/effective-date scan.      | source   |
| `UX_SUBSCRIPTIONS_ONE_CURRENT`           | Y      | `CASE WHEN subscription_status IN ('TRIAL','ACTIVE','PAST_DUE','GRACE','SUSPENDED') THEN tenant_id END` | Tenant invoice/payment reconciliation or global subscription status/effective-date scan.      | proposed |
| `IX_SUB_SCHEDULED_START`                 | N      | `SUBSCRIPTION_STATUS,STARTS_AT_UTC,SUBSCRIPTION_ID`                                                     | Tenant invoice/payment reconciliation or global subscription status/effective-date scan.      | proposed |

## SUBSCRIPTION_INVOICES

| Name                                   | Unique | Ordered columns / expression                        | Query purpose                                                                                 | Origin   |
| -------------------------------------- | ------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `PK_SUBSCRIPTION_INVOICES` backing key | Y      | `SUBSCRIPTION_INVOICE_ID`                           | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_SI_TENANT_ID` backing key          | Y      | `TENANT_ID, SUBSCRIPTION_INVOICE_ID`                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_SI_NUMBER` backing key             | Y      | `TENANT_ID, INVOICE_NUMBER`                         | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_INVOICE_CURRENCY` backing key      | Y      | `TENANT_ID, SUBSCRIPTION_INVOICE_ID, CURRENCY_CODE` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |
| `IX_SI_STATUS`                         | N      | `tenant_id, invoice_status, due_at_utc`             | Tenant invoice/payment reconciliation or global subscription status/effective-date scan.      | source   |
| `IX_SI_SUBSCRIPTION`                   | N      | `tenant_id, subscription_id, issued_at_utc`         | Tenant invoice/payment reconciliation or global subscription status/effective-date scan.      | source   |
| `IX_FK_SI_SUBSCRIPTION`                | N      | `TENANT_ID,SUBSCRIPTION_ID,CURRENCY_CODE`           | FK child lookup/parent maintenance using the exact leading relationship columns               | proposed |

## SUBSCRIPTION_PAYMENTS

| Name                                             | Unique | Ordered columns / expression                        | Query purpose                                                                                 | Origin   |
| ------------------------------------------------ | ------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `PK_SUBSCRIPTION_PAYMENTS` backing key           | Y      | `SUBSCRIPTION_PAYMENT_ID`                           | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_SP_TENANT_ID` backing key                    | Y      | `TENANT_ID, SUBSCRIPTION_PAYMENT_ID`                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_SUBSCRIPTION_PAYMENTS_PUBLIC_ID` backing key | Y      | `TENANT_ID, PUBLIC_ID`                              | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |
| `IX_SP_INVOICE`                                  | N      | `tenant_id, subscription_invoice_id`                | Tenant invoice/payment reconciliation or global subscription status/effective-date scan.      | source   |
| `IX_SUBSCRIPTION_PAYMENTS_USER`                  | N      | `recorded_by_user_id, received_at_utc`              | Tenant invoice/payment reconciliation or global subscription status/effective-date scan.      | source   |
| `IX_FK_SP_VOID_USER`                             | N      | `VOIDED_BY_USER_ID`                                 | FK child lookup/parent maintenance using the exact leading relationship columns               | proposed |
| `IX_FK_SP_INVOICE`                               | N      | `TENANT_ID,SUBSCRIPTION_INVOICE_ID,CURRENCY_CODE`   | FK child lookup/parent maintenance using the exact leading relationship columns               | proposed |
| `IX_FK_SP_ADMIN_ACTOR`                           | N      | `RECORDED_BY_PLATFORM_ADMIN_ID,RECORDED_BY_USER_ID` | FK child lookup/parent maintenance using the exact leading relationship columns               | proposed |

## WEBSITE_THEMES

| Name                                 | Unique | Ordered columns / expression | Query purpose                                                                                 | Origin |
| ------------------------------------ | ------ | ---------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| `PK_WEBSITE_THEMES` backing key      | Y      | `THEME_ID`                   | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |
| `UQ_WEBSITE_THEMES_CODE` backing key | Y      | `THEME_CODE`                 | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |

## WEBSITE_SETTINGS

| Name                                        | Unique | Ordered columns / expression     | Query purpose                                                                                 | Origin   |
| ------------------------------------------- | ------ | -------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `PK_WEBSITE_SETTINGS` backing key           | Y      | `WEBSITE_ID`                     | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_WEBSITE_SETTINGS_TENANT_ID` backing key | Y      | `TENANT_ID, WEBSITE_ID`          | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_WEBSITE_SETTINGS_BUSINESS` backing key  | Y      | `TENANT_ID, BUSINESS_ID`         | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_WEBSITE_SETTINGS_SUBDOMAIN` backing key | Y      | `SUBDOMAIN_SLUG`                 | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_WEBSITE_SETTINGS_PUBLIC_ID` backing key | Y      | `TENANT_ID, PUBLIC_ID`           | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |
| `IX_WEBSITE_SETTINGS_STATUS`                | N      | `website_status, subdomain_slug` | Published site/media lookup; hostname slug is served by the unique backing key.               | source   |
| `IX_WEBSITE_SETTINGS_THEME`                 | N      | `theme_id`                       | Published site/media lookup; hostname slug is served by the unique backing key.               | source   |

## WEBSITE_MEDIA

| Name                                      | Unique | Ordered columns / expression                       | Query purpose                                                                                 | Origin   |
| ----------------------------------------- | ------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `PK_WEBSITE_MEDIA` backing key            | Y      | `WEBSITE_MEDIA_ID`                                 | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_WEBSITE_MEDIA_TENANT_ID` backing key  | Y      | `TENANT_ID, WEBSITE_MEDIA_ID`                      | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_WEBSITE_MEDIA_OBJECT_KEY` backing key | Y      | `OBJECT_KEY`                                       | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source   |
| `UQ_WEBSITE_MEDIA_PUBLIC_ID` backing key  | Y      | `TENANT_ID, PUBLIC_ID`                             | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |
| `IX_WEBSITE_MEDIA_BUSINESS`               | N      | `tenant_id, business_id, display_order`            | Published site/media lookup; hostname slug is served by the unique backing key.               | source   |
| `IX_WEBSITE_MEDIA_LOCATION`               | N      | `tenant_id, business_id, location_id, resource_id` | Published site/media lookup; hostname slug is served by the unique backing key.               | source   |

## NOTIFICATION_TEMPLATES

| Name                                    | Unique | Ordered columns / expression                              | Query purpose                                                                                                              | Origin |
| --------------------------------------- | ------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| `PK_NOTIFICATION_TEMPLATES` backing key | Y      | `NOTIFICATION_TEMPLATE_ID`                                | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                              | source |
| `UX_NT_SCOPE`                           | Y      | `NVL(tenant_id,0), template_code, channel, language_code` | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source |
| `IX_NT_TENANT`                          | N      | `tenant_id, template_code`                                | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source |

## NOTIFICATIONS

| Name                                     | Unique | Ordered columns / expression                       | Query purpose                                                                                                              | Origin   |
| ---------------------------------------- | ------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| `PK_NOTIFICATIONS` backing key           | Y      | `NOTIFICATION_ID`                                  | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                              | source   |
| `UQ_NOTIFICATIONS_TENANT_ID` backing key | Y      | `TENANT_ID, NOTIFICATION_ID`                       | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                              | source   |
| `UQ_NOTIFICATION_SCOPE` backing key      | Y      | `SCOPE_TENANT_ID, NOTIFICATION_ID`                 | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                              | proposed |
| `UQ_NOTIFICATION_DEDUPE` backing key     | Y      | `SCOPE_TENANT_ID, DEDUPE_KEY`                      | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                              | proposed |
| `IX_NOTIFICATIONS_QUEUE`                 | N      | `tenant_id, notification_status, scheduled_at_utc` | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source   |
| `IX_NOTIFICATIONS_BOOKING`               | N      | `tenant_id, booking_id, created_at_utc`            | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source   |
| `IX_NOTIFICATIONS_USER`                  | N      | `recipient_user_id, created_at_utc`                | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source   |
| `IX_FK_NOTIFICATIONS_TEMPLATE`           | N      | `NOTIFICATION_TEMPLATE_ID`                         | FK child lookup/parent maintenance using the exact leading relationship columns                                            | proposed |

## NOTIFICATION_LOGS

| Name                                         | Unique | Ordered columns / expression                       | Query purpose                                                                                                              | Origin   |
| -------------------------------------------- | ------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| `PK_NOTIFICATION_LOGS` backing key           | Y      | `NOTIFICATION_LOG_ID`                              | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                              | source   |
| `UQ_NOTIFICATION_LOGS_TENANT_ID` backing key | Y      | `TENANT_ID, NOTIFICATION_LOG_ID`                   | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                              | source   |
| `UQ_NOTIFICATION_ATTEMPT` backing key        | Y      | `SCOPE_TENANT_ID, NOTIFICATION_ID, ATTEMPT_NUMBER` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                              | proposed |
| `IX_NL_NOTIFICATION`                         | N      | `tenant_id, notification_id, attempted_at_utc`     | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source   |

## OUTBOX_EVENTS

| Name                           | Unique | Ordered columns / expression                      | Query purpose                                                                                                              | Origin |
| ------------------------------ | ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| `PK_OUTBOX_EVENTS` backing key | Y      | `OUTBOX_EVENT_ID`                                 | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                              | source |
| `IX_OUTBOX_EVENTS_READY`       | N      | `event_status, available_at_utc, outbox_event_id` | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source |
| `IX_OUTBOX_EVENTS_TENANT`      | N      | `tenant_id, event_status, available_at_utc`       | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source |

## JOB_QUEUE

| Name                       | Unique | Ordered columns / expression                                                                                       | Query purpose                                                                                                              | Origin   |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| `PK_JOB_QUEUE` backing key | Y      | `JOB_ID`                                                                                                           | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                              | source   |
| `IX_JOB_QUEUE_READY`       | N      | `job_status, run_after_utc, job_id`                                                                                | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source   |
| `UX_JOB_QUEUE_DEDUPE`      | Y      | `CASE WHEN dedupe_key IS NOT NULL THEN NVL(tenant_id,0) END, CASE WHEN dedupe_key IS NOT NULL THEN dedupe_key END` | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source   |
| `IX_JOB_QUEUE_TENANT`      | N      | `tenant_id, job_status, run_after_utc`                                                                             | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source   |
| `IX_JOB_LEASE_EXPIRY`      | N      | `JOB_STATUS,LEASE_EXPIRES_AT_UTC,JOB_ID`                                                                           | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | proposed |

## IDEMPOTENCY_KEYS

| Name                                   | Unique | Ordered columns / expression                               | Query purpose                                                                                                              | Origin   |
| -------------------------------------- | ------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| `PK_IDEMPOTENCY_KEYS` backing key      | Y      | `IDEMPOTENCY_ID`                                           | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                              | source   |
| `UQ_IDEMPOTENCY_OWNER_KEY` backing key | Y      | `TENANT_ID, OPERATION_SCOPE, OWNER_SCOPE, IDEMPOTENCY_KEY` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                              | proposed |
| `IX_IDEMPOTENCY_EXPIRY`                | N      | `expires_at_utc`                                           | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source   |

## AUDIT_LOGS

| Name                                  | Unique | Ordered columns / expression                     | Query purpose                                                                                                              | Origin   |
| ------------------------------------- | ------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| `PK_AUDIT_LOGS` backing key           | Y      | `AUDIT_LOG_ID`                                   | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                              | source   |
| `UQ_AUDIT_LOGS_PUBLIC_ID` backing key | Y      | `PUBLIC_ID`                                      | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index.                              | proposed |
| `IX_AUDIT_LOGS_TENANT_TIME`           | N      | `tenant_id, created_at_utc`                      | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source   |
| `IX_AUDIT_LOGS_ACTOR_TIME`            | N      | `actor_user_id, created_at_utc`                  | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source   |
| `IX_AUDIT_LOGS_ENTITY`                | N      | `tenant_id, entity_type, entity_public_id`       | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source   |
| `IX_AUDIT_LOGS_MEMBERSHIP`            | N      | `tenant_id, actor_membership_id, created_at_utc` | Due/lease claim or tenant/audit/delivery history, according to status/time/actor leading columns; no raw payload indexing. | source   |
| `IX_FK_AUDIT_LOGS_MEMBERSHIP_ACTOR`   | N      | `TENANT_ID,ACTOR_MEMBERSHIP_ID,ACTOR_USER_ID`    | FK child lookup/parent maintenance using the exact leading relationship columns                                            | proposed |
| `IX_FK_AUDIT_ADMIN_USER`              | N      | `ACTOR_PLATFORM_ADMIN_ID,ACTOR_USER_ID`          | FK child lookup/parent maintenance using the exact leading relationship columns                                            | proposed |

## ONBOARDING_PROGRESS

| Name                                 | Unique | Ordered columns / expression        | Query purpose                                                                                 | Origin |
| ------------------------------------ | ------ | ----------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| `PK_ONBOARDING_PROGRESS` backing key | Y      | `ONBOARDING_PROGRESS_ID`            | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |
| `UQ_ONBOARDING_STEP` backing key     | Y      | `TENANT_ID, BUSINESS_ID, STEP_CODE` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | source |

## INVITATION_LOCATIONS

| Name                                  | Unique | Ordered columns / expression            | Query purpose                                                                                 | Origin   |
| ------------------------------------- | ------ | --------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `PK_INVITATION_LOCATIONS` backing key | Y      | `TENANT_ID, INVITATION_ID, LOCATION_ID` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |
| `IX_FK_IL_LOCATION`                   | N      | `TENANT_ID,LOCATION_ID`                 | FK child lookup/parent maintenance using the exact leading relationship columns               | proposed |

## SUBSCRIPTION_FEATURE_SNAPSHOTS

| Name                                   | Unique | Ordered columns / expression               | Query purpose                                                                                 | Origin   |
| -------------------------------------- | ------ | ------------------------------------------ | --------------------------------------------------------------------------------------------- | -------- |
| `PK_SUB_FEATURE_SNAPSHOTS` backing key | Y      | `TENANT_ID, SUBSCRIPTION_ID, FEATURE_CODE` | Exact identity/uniqueness and leading-prefix parent/FK access; do not add an identical index. | proposed |

D-18 approves the scoped Step 07 structure/index inventory, including tenant role-name uniqueness. Actual index validity/query plans remain Oracle verification work; broader future-table indexes remain design proposals.

23 November 2026: all 30 explicit Step 07 indexes plus required PK/UK/LOB backing metadata passed actual Oracle verification. Query-plan/capacity benchmarking and broader future-table indexes are not claimed. [Evidence](step07-verification.md).

## Step 08 verified index overlay

The ten new tables now use 37 documented explicit index definitions, including two D-21 conditional finance unique indexes; no PK/UK backing index is duplicated. Calendar/customer/status filters, tenant hold expiry and bounded global expiry discovery, slot deletion by booking/hold owner, booking receipt and original-payment refund reconciliation have separate leading-key paths. Prefix overlaps are query-shape proposals, not measured performance promises. UX_BOOKINGS_SOURCE_HOLD is the source conditional unique index, not a nullable composite UK that would constrain repeated manual bookings. Original 30 Step 07 explicit indexes remain unchanged. [Executed scope and limits](step08-verification.md).

D-21 adds UX_PAYMENTS_POSTED_BOOKING (RECEIVED only, tenant/booking) and UX_REFUNDS_PROCESSED_PAYMENT (PROCESSED only, tenant/payment). Both CASE expressions become null for excluded history, preserving multiple voided/requested/rejected records. They guarantee neither full amounts nor eligible status/aggregate totals. The original 30 Step 07 explicit indexes remain byte-identical; combined explicit inventory is 67. [Oracle conditional-uniqueness example](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-INDEX.html) was consulted; actual catalog and duplicate-rejection checks passed under D-22; query-plan/capacity performance is not claimed.
