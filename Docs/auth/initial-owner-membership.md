# Initial owner membership

One verification transaction consumes the live token, stores the mailbox holder's password hash and verified profile, activates the user, creates a new tenant in `PENDING_ONBOARDING`, and adds an active membership with the `BUSINESS_OWNER` role. Server-generated UUIDs identify the rows. Composite tenant relationships protect role assignment scope. The transaction also inserts scoped verification and membership audit events. Failures roll back the transition, including token consumption, owner grants and audit writes.

The active owner role receives the 19 approved tenant permissions by exact allowlist. `subscription.manage` remains reserved. `BUSINESS_MANAGER` and `RECEPTIONIST` start inactive and receive no assignments or mappings. The transition creates no platform administrator, session, subscription, trial or entitlement. The tenant name is a display name. Legal business and facility details follow in onboarding. [Reviewed permission list](step11-decision-review.md#proposed-contracts-and-controls)

## Forward migration and grants

`000027_owner_registration` widens tenant status while retaining the existing constraint name and validates the new constraint before dropping the old one. It permits a null `USERS.PASSWORD_HASH` only while the account is pending. It adds the durable source-window table, the expiry and issuance indexes, and the worker's read-only eligibility view. Existing migrations and their checksums remain intact. The migration owner needs `CREATE VIEW` for the reviewed delivery projection. Oracle DDL commits independently; inspect the ledger and catalog if a migration fails.

The [exact runtime grants](../../database/provisioning/step11-runtime-grants.mjs) give the API required locking and lookup access, column-limited inserts and updates, and append-only access to audit and outbox intent. The worker receives read access to the eligibility view. Its role gains no direct base user or credential access. Application grants need review after isolated Oracle verification. [Operator verification](registration.md#isolated-oracle-verification)
