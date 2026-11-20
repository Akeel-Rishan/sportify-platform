# Server-only Oracle connectivity

`@sportify/database` owns the Thin driver, pure configuration validation, process-local pool factory, UTC checkout, scoped parameterized queries and explicit transactions. It imports no applications and contains no environment loader, business model, migration runner or credentials. Node-only exports and the web lint boundary prevent browser consumption.

See [secure connectivity](../../Docs/database/secure-connectivity.md), [pool/session ownership](../../Docs/database/connection-pooling.md) and [verification gates](../../Docs/database/oracle-verification.md). Driver mocks are unit evidence only.
