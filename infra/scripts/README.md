# Infrastructure scripts

Step 06 adds explicit `oracle-connectivity-check.mjs` and `oracle-privilege-check.mjs` commands. They use public compiled workspace exports, require secure process environment and an operator-designated development/pilot target, and never provision or create business objects. See [Oracle verification](../../Docs/database/oracle-verification.md). No cloud/network/deployment action has been executed.

Step 07 adds database-plan/status/migrate/verify wrappers for `@sportify/migrations`. They use a separate explicitly selected migration-owner environment, never app .env files or startup hooks. Mutation/verification is review-gated; no Oracle has been executed. See [operator guide](../../Docs/database/migration-guide.md). The disposable live runner subset is separately invoked from database/tests and is not a full Step 07 integrity suite.
