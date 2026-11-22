# Operator-only migration tooling

`@sportify/migrations` owns artifact loading/checksums, owner-only configuration, one-session Oracle execution/locking, the sole SCHEMA_MIGRATIONS history and catalog comparisons. It is never imported by applications and never runs on startup. It uses the existing pinned Thin mTLS driver and public wallet preflight from `@sportify/database`; no owner credentials enter shared-config or runtime schemas.

Current artifacts remain **review-gated** pending the Step 05 structural decisions identified in the [migration guide](../../Docs/database/migration-guide.md). Local tests are driver/metadata unit evidence, not Oracle execution. See [implementation inventory](../../Docs/database/implemented-schema.md), [reference seeds](../../Docs/database/reference-seeds.md) and [live gates](../../Docs/database/oracle-verification.md).
