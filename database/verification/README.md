# Schema verification

`pnpm db:verify` uses the compiled operator-only verifier and the immutable manifest's explicit postconditions. It checks the selected real owner schema only after the review gate is ready and pending versions are absent. It compares exact metadata rather than borrowing the broad source verification table counts. It performs no migrations, grants or repairs, and obtains the same session advisory lock to avoid racing a migration.

Current verification is blocked by pending Step 05 decisions and the unverified Oracle target/wallet/owner setup. No query-plan, constraint-enforcement or Oracle execution success is claimed. See [migration guide](../../Docs/database/migration-guide.md) and [remaining schema scope](../../Docs/database/implemented-schema.md).
