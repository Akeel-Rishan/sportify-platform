# Health and readiness

## Liveness

`GET /api/v1/health` returns 200 and checks this API process only:

```json
{
  "success": true,
  "data": { "status": "ok", "service": "sportify-api" },
  "requestId": "4b68fda1-4273-4aca-b3e0-6a0b7b154351"
}
```

It does not call external services or reveal environment names, versions, hostnames, internal paths or configuration. Both endpoints are currently unauthenticated; future authentication must retain a deliberate probe policy.

## Application readiness

`GET /api/v1/ready` returns 200 once the application has bootstrapped:

```json
{
  "success": true,
  "data": { "status": "ready", "scope": "application" },
  "requestId": "4b68fda1-4273-4aca-b3e0-6a0b7b154351"
}
```

The injected ReadinessService starts false, becomes true at `onApplicationBootstrap`, and becomes false at `onModuleDestroy`. Normal `listen()` completes initialization before accepting HTTP traffic. A service reporting unavailable produces 503:

```json
{
  "success": false,
  "error": { "code": "SERVICE_UNAVAILABLE", "message": "The service is temporarily unavailable." },
  "requestId": "4b68fda1-4273-4aca-b3e0-6a0b7b154351"
}
```

Liveness remains independent. Tests inject an unavailable service; there is no public toggle or fake dependency-health environment flag. Startup/shutdown state and failure responses are tested, but full load-balancer draining, proxy configuration and POSIX signal delivery are not implemented/proven here.

**Oracle is not implemented or checked.** This response establishes application-only readiness, not booking, payment, tenant or commercial readiness. When Oracle integration is implemented, a real bounded Oracle readiness check must become a required condition before this endpoint can report ready. Do not substitute a mock or hardcoded healthy database flag.

Both endpoints set `Cache-Control: no-store`, including unavailable/error responses. They return the same fresh `X-Request-ID` in their response envelope and structured logs. HEAD responses contain no body. Early parser errors also use the standard safe envelope and no-store policy.

## Local verification

After a production build, run the API in a separate terminal:

```sh
pnpm build
pnpm --filter @sportify/api start
```

Use `npx --yes pnpm@10.34.9` in place of pnpm if it is not installed. Windows and Unix can use Node's built-in fetch:

```sh
node -e "fetch('http://localhost:4000/api/v1/health').then(async r => console.log(r.status, r.headers.get('x-request-id'), await r.json()))"
node -e "fetch('http://localhost:4000/api/v1/ready').then(async r => console.log(r.status, r.headers.get('cache-control'), await r.json()))"
```

An unimplemented route returns normalized 404. Ctrl+C stops the API. Never add a production error-demo route to verify the filter; use the [HTTP integration suites](../development/testing.md).
