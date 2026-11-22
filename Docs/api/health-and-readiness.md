# Health and readiness

## Liveness

`GET /api/v1/health` returns process-only HTTP 200 with no database operation:

```json
{
  "success": true,
  "data": { "status": "ok", "service": "sportify-api" },
  "requestId": "<server-generated UUID>"
}
```

## Oracle-required readiness (Step 06)

`GET /api/v1/ready` returns HTTP 200 only after Nest initialization and a successful runtime-pool probe with a UTC session:

```json
{
  "success": true,
  "data": { "status": "ready", "scope": "application-and-oracle" },
  "requestId": "<server-generated UUID>"
}
```

The probe runs a bound SELECT from DUAL, checks its value and SESSIONTIMEZONE after the checkout UTC reset, and releases the connection. It verifies connectivity/session state, not business tables, authorization, booking/payment workflows or commercial readiness. Oracle is now a required implemented dependency; the earlier application-only response is superseded.

Before initialization, after shutdown starts, or on a database/probe failure, return HTTP 503:

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "The service is temporarily unavailable."
  },
  "requestId": "<server-generated UUID>"
}
```

Both routes are unauthenticated and set `Cache-Control: no-store`, including failures; HEAD contains no body. Fresh X-Request-ID matches body/completion/error records. No username, target, version, wallet path, raw driver error or internal diagnostics are exposed. Internal dependency events carry fixed classifications only; coalesced pool probes are process events, while HTTP completion/error events retain their own request IDs.

Simultaneous probes share one check. Both success and failure are cached for **1 second after completion**, measured monotonically. This bounds health pressure but permits up to one second of stale readiness; recovery is reevaluated after expiry. No public toggle or environment fake-health switch exists. Tests inject the dependency explicitly.

Invalid configuration fails before allocation. Pool initialization errors fail startup safely without retry; minimum-zero pools can initialize without Oracle, so `/health` can remain live and `/ready` returns 503 until an actual probe succeeds. Connection/queue/call budgets and 5-second shutdown drain are documented in [pool lifecycle](../database/connection-pooling.md). These are per-operation driver limits, not a proven end-to-end network SLA or full load-balancer drain. Readiness is marked unavailable before pool shutdown and does not become healthy again if an in-flight check finishes during shutdown.

## Verification

After operator provisioning and secure runtime setup:

```sh
pnpm build
pnpm --filter @sportify/api start
```

Use `npx --yes pnpm@10.34.9` instead of pnpm if necessary. From another terminal, Windows and Unix can use:

```sh
node -e "fetch('http://localhost:4000/api/v1/health').then(async r => console.log(r.status, r.headers.get('x-request-id'), await r.json()))"
node -e "fetch('http://localhost:4000/api/v1/ready').then(async r => console.log(r.status, r.headers.get('cache-control'), await r.json()))"
```

API `/` remains a safe 404. Ctrl+C stops the process. Do not start production and development APIs simultaneously on 4000. [Local HTTP tests](../development/testing.md) use injected database state and real Nest HTTP; they do not prove Oracle availability. [Explicit live evidence](../database/oracle-verification.md) now records actual restricted Oracle identities, real-pool readiness/liveness behavior and the built API main on Windows. Controlled local pool closure passed; an actual remote outage/recovery and production draining remain unverified.
