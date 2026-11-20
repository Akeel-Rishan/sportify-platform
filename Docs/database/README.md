# SPORTIFY MVP database design

**Step 05: awaiting user review. Design only.** No Oracle instance, account, migration execution, driver connection or business feature was created. Existing Steps 01-04 and web application are preserved. This folder is the working MVP design; uploaded documents remain immutable historical inputs.

## Document ownership

| Document                                                      | Owns                                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [Table disposition](mvp-table-scope.md)                       | All 61 source tables: 52 included, nine deferred; two proposed additions                                                  |
| [Data dictionary](data-dictionary.md)                         | Exact proposed columns, datatypes/defaults/nullability, meaning, validation, immutability and table lifecycle/sensitivity |
| [Relationships/constraints](relationships-and-constraints.md) | Exact named keys, FKs, checks and optional/scope behavior                                                                 |
| [Booking invariants](booking-invariants.md)                   | Time/grid/buffers, transaction and locking protocol, maintenance races                                                    |
| [Financial rules](financial-rules.md)                         | Money, immutable receipts/refunds, summary formulas and manual subscription history                                       |
| [Operational data](operational-data.md)                       | Outbox/jobs/delivery/idempotency/audit boundaries, scopes, leases and safe payloads                                       |
| [Index plan](index-plan.md)                                   | Key-backed versus explicit indexes and query reasons                                                                      |
| [Migration strategy](migration-strategy.md)                   | Provisioning, least privilege, baseline/ledger, serialization and DDL recovery                                            |
| [Verification plan](verification-plan.md)                     | Executed static checks versus mandatory future Oracle evidence                                                            |
| [Access ERD](erd-platform-and-access.md)                      | Platform/global identity and tenant access                                                                                |
| [Venues/bookings ERD](erd-venues-and-bookings.md)             | Tenant configuration, slots and website context                                                                           |
| [Finance/operations ERD](erd-finance-and-operations.md)       | Separate money flows and operational records                                                                              |

The proposed target currently has **54 tables**: 52 required source tables plus INVITATION_LOCATIONS and SUBSCRIPTION_FEATURE_SNAPSHOTS. New columns/constraints/statuses are explicitly proposed in the dictionary/register; this is not a claim the source SQL already contains them. No existing implemented table was removed because no Oracle schema has been implemented. Nine deferred catalog tables stay outside MVP migration design: recurrence, gateway attempts/webhooks, custom domains/verification, advanced support and marketplace/reviews/responses.

## Sources found, read and missing

Found/read: [MVP PDF](../02-mvp-scope-business-workflows.md.pdf) (29 pages), [architecture PDF](../03-technical-architecture.md.pdf) (53 pages), [schema overview PDF](../04-oracle-database-schema.md.pdf) (8 pages), [complete database specification](../SPORTIFY_Database_Design_Package_v1.0/SPORTIFY_Database_Schema_Specification.md), [bootstrap SQL](../SPORTIFY_Database_Design_Package_v1.0/001_sportify_schema.sql), [verification SQL](../SPORTIFY_Database_Design_Package_v1.0/002_verify_schema.sql), all three [source ERDs](../README.md#source-register), [API specification](../SPORTIFY_API_Contract_Package_v1.0/SPORTIFY_API_Specification_v1.0.md) and OpenAPI schemas/identifier fields, and current scope/decision/traceability/roadmap/progress/definition-of-done documents. Bootstrap has 61 tables, 361 named source constraints and 90 explicit source indexes; counts are static, not Oracle results.

The repository's database/migrations, seeds, procedures and indexes directories contain explanatory README files, not executable migrations. Missing: a reviewed MVP-only executable baseline, actual ATP release/compatibility/charset evidence, schema grants/provisioning scripts, a migration runner/history of real execution, target integration/concurrency/query-plan evidence, numerical retention/grace/replay/security policies, and acceptance of the listed design decisions. Separate referenced auth/provisioning specifications remain missing; these documents provide design guidance, not a claim those implementations exist. No source artifact is assumed missing merely because its original reference used a different directory casing.

## Oracle compatibility and evidence

Design targets **Oracle Database 19c-compatible SQL on ATP**, matching the source bootstrap. This is a conservative syntax target, not a claim that a future ATP instance runs 19c. Record the actual deployed database release/compatibility and service restrictions before implementation; do not assume native newer-release JSON/UUID/BOOLEAN types, newer SQL syntax, unrestricted privileges or current Free-tier capabilities. CHAR(1) Y/N, UUID VARCHAR2, TIMESTAMP(6) UTC and NUMBER money follow the user's explicit Step 05 direction. Verify AL32UTF8, STANDARD/EXTENDED string byte limits and supported timezone regions on that target.

Official references consulted on 20 November 2026:

- [Oracle 19c constraints](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/constraint.html): exact matching parent keys; any nullable component can bypass composite FK checking. Explicit all-or-none guards are required for optional scoped relationships.
- [Oracle data integrity](https://docs.oracle.com/en/database/oracle/oracle-database/19/cncpt/data-integrity.html) and [nulls](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Nulls.html): partly-null composite unique keys still constrain equal remaining components; zero-length character values are null. CHECK does not replace conditional NOT NULL validation.
- [Datatypes](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Data-Types.html): CHAR versus BYTE semantics, numeric precision/scale and timestamp representation. CHAR semantics do not remove byte/index limits; e.g. a 2000-character notes field must also fit its actual database byte limit or be deliberately migrated to appropriate text storage.
- [COMMIT](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/COMMIT.html): DDL commits before/after; multi-statement rollback is not promised.
- [SELECT/FOR UPDATE/SKIP LOCKED](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SELECT.html): row locking and queue consumer behavior. Domain locks wait in a defined order; queue skip-lock claims are short separate transactions.
- [DBMS_LOCK](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_LOCK.html): session lock semantics; exact availability/grants/release behavior must be tested on ATP.
- [SYS_EXTRACT_UTC](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SYS_EXTRACT_UTC.html) and [Autonomous initialization parameters](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/autonomous-initialization-parameters.html): explicit UTC extraction/session initialization rather than host-clock assumptions.
- [ORA-02261](https://docs.oracle.com/en/error-help/db/ora-02261/): duplicate PK/UK source risk in PLATFORM_ADMINS; proposed target removes the redundant key. [node-oracledb execution/number handling](https://node-oracledb.readthedocs.io/en/latest/user_guide/sql_execution.html): future exact-string fetching/binding and statement boundaries; no driver version is selected/installed here.

## Review gate

The [Step 05 decision register](../planning/decision-register.md#step-05-design-review) distinguishes explicit user direction from recommendations. Approve/revise MVP additions, locking/maintenance, buffers/overnight contract, protected hold pricing, partial/refund/zero-value policy, token reconstruction, scoped operational records and subscription history before dependent DDL/workflows. Trial/grace/retention/retry timing and customer matching remain named policy gates; no guessed value is a commercial approval.

This package is ready for design review. It is **not yet unconditionally ready to execute database implementation**: accept structural/security blockers, verify actual target capabilities and prepare reviewed migrations first. All Oracle tests remain unexecuted. Step 06 is not started.
