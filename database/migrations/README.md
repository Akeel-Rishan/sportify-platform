# Versioned migration artifacts

`manifest.json` is the sole explicit inventory for compiled operator tooling. Current entries are 000001 migration history, 000002 reference catalogs and 000003 launch sports (the seed file lives under database/seeds). The manifest remains **review-gated** pending the documented Step 05 structural decisions and completion of the scoped Step 07 subset. No artifact has been executed on Oracle by this agent. Do not execute the broad uploaded bootstrap or register BOOTSTRAP-001.

See [migration guide](../../Docs/database/migration-guide.md), [implementation inventory](../../Docs/database/implemented-schema.md) and [reference seeds](../../Docs/database/reference-seeds.md). Each SQL file is one execute call, canonical UTF-8/LF without terminators; whole PL/SQL blocks retain internal semicolons and omit client slash lines. Applied files/metadata are immutable. `pnpm db:plan` is local format/checksum evidence only, not an Oracle dry-run.
