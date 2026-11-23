# Step 07 reference seed artifacts

D-18 explicitly approves eight sports in 000003 and all 20 tenant permission codes in 000011. Actual Oracle deployment and twice-executed customization-preserving seed tests passed; see [evidence](../../Docs/database/step07-verification.md). Both MERGE by stable natural key, insert missing records only and preserve existing customization. Generated IDs are not hardcoded; no tenant/role assignment, sample account, password, platform permission or business fixture is seeded.

See [reference catalog](../../Docs/database/reference-seeds.md), [release manifest](../migrations/manifest.json) and [disposable seed verification](../tests/README.md).
