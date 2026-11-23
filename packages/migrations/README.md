# Operator-only migration tooling

`@sportify/migrations` owns artifact loading/checksums, owner-only configuration, one-session Oracle execution/locking, the sole SCHEMA_MIGRATIONS history and catalog comparisons. Applications never import or run it at startup. It uses the existing pinned Thin mTLS driver and public wallet preflight from `@sportify/database`.

D-18 approves the scoped Step 07 release. Manifest ready means design-approved, not Oracle-verified. Protected target/identity/lock/catalog and disposable live-suite gates remain mandatory. See [migration guide](../../Docs/database/migration-guide.md), [SQL inventory](../../Docs/database/implemented-schema.md) and [live evidence](../../Docs/database/oracle-verification.md).

23 November 2026: actual application-owner clean apply/repeat/catalog and the isolated recovery/integrity/privilege suite passed. The verifier recognizes only matched declared LOB/extended VARCHAR2 storage. Existing SQL/checksums remain immutable; [evidence and retained first-run repair](../../Docs/database/step07-verification.md) distinguish test-only history from the original application release.
