# Step 07 verification

`python database/verification/verify-step07-design.py` statically compares the exact 26-table scope, SQL columns/defaults/nullability/identity, named constraints and explicit indexes against the Step 05 dictionary/register and Step 07 manifest. It rejects duplicate/out-of-scope tables and reports no Oracle evidence.

`pnpm db:verify` is the real migration-owner catalog/seed check after approved migration application, with the same verified owner connection and advisory lock. D-18 approves the current ready release; owner/target/history/lock checks still apply. Catalog comparison includes parent keys/owner, enabled/validated/immediate constraints, NO ACTION deletion, valid indexes/LOB backing objects, invalid-object absence and stable reference-key presence. Actual Oracle metadata formatting is still unverified for these Step 07 artifacts.

The explicit disposable [Step 07 suite](../tests/README.md) adds exact error/constraint integrity cases, seed reruns/customization, DDL-commit/concurrent locking, retained failed history/forward repair and runtime access-denial evidence. None has run yet. [Step 06 connectivity](../../Docs/database/oracle-verification.md) does not prove installed business schema or authentication behavior.

Actual Step 07 Oracle catalog/integrity/recovery/privilege and application clean/repeat checks passed on 23 November 2026. [Dated results](../../Docs/database/step07-verification.md) include the corrected extended VARCHAR2 storage case and retained test-only repair history. Static checks remain distinct from these real results.

Step 08: python database/verification/verify-step08-design.py checks 17 draft phases/36 combined tables and exact dictionary/register/index agreement, including slot PK/owner keys and conditional conversion uniqueness. Step 07 checker is fixed to its first 11 immutable baseline entries. Neither executes Oracle SQL. [New live gate](../../Docs/database/step08-verification.md).
