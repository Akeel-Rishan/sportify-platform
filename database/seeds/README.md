# Reference seed artifacts

The initial eight launch sports use one insert-only natural-key MERGE under `000003_launch_sports`, declared/checksummed in the same migration manifest as schema changes. It does not update existing customizations, hardcode identity IDs, seed OTHER or create a default administrator/tenant/demo record. Permission seed selection remains pending the explicit Q-18 choice. All artifacts are review-gated and unexecuted on Oracle. See [seed ownership](../../Docs/database/reference-seeds.md).
