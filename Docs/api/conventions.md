# API conventions

Step 04 introduces transport infrastructure only. The existing Nest 11.2.10 / Express 5.2.1 adapter and framework pins are retained. Production has only the two [health endpoints](health-and-readiness.md); test demonstration routes never enter the production module/build.

## Paths and responses

`configureApp()` applies `api/v1` once. Controllers declare relative paths without repeating the prefix. `@sportify/api-contracts` exports framework-independent `ApiSuccess<T>`, `ApiErrorResponse`, `ApiResponse<T>`, `ValidationIssue`, stable error codes and health payload types. No Nest class or runtime environment is exported there.

Controllers return application payloads. The global success interceptor adds the envelope once:

```http
HTTP/1.1 200 OK
X-Request-ID: 4b68fda1-4273-4aca-b3e0-6a0b7b154351
Content-Type: application/json

{"success":true,"data":{"status":"ok","service":"sportify-api"},"requestId":"4b68fda1-4273-4aca-b3e0-6a0b7b154351"}
```

Arbitrary payload fields named `success`, `data` or `requestId` do not signal prior wrapping. They remain payload data. An ordinary body-bearing `undefined` becomes JSON `null`. Controllers must not manually assemble transport envelopes.

| Status | Convention                                                                                    |
| ------ | --------------------------------------------------------------------------------------------- |
| 200    | Successful reads and ordinary updates; explicitly use `@HttpCode(200)` for POST-based updates |
| 201    | Created resource; Nest's POST default is preserved                                            |
| 202    | Only when actual asynchronous work has been accepted; no such production endpoint exists yet  |
| 204    | Successful response with no body                                                              |

Explicit statuses are preserved. HEAD, 204 and 304 responses receive no JSON body. Redirect metadata/statuses, SSE metadata, `StreamableFile`, already-sent responses and explicitly declared non-JSON content types bypass ordinary wrapping. Use `@BypassEnvelope()` for non-JSON handlers and class-level non-JSON controllers. A file must use Nest's `StreamableFile` or a correctly managed native response; a raw Node stream still needs an appropriate streaming response strategy. A native `@Res()` handler owns sending/ending its response. Bypass does not bypass request IDs, logging or safe exceptions before headers are sent. No production downloads or SSE are implemented.

## Request IDs and logging

Every application HTTP request gets a fresh cryptographic `crypto.randomUUID()` stored on that request under a private symbol. The same ID is returned as `X-Request-ID`, included in JSON envelopes and written in completion/error records. Incoming IDs are ignored. No mutable current-request global or AsyncLocalStorage is needed for these HTTP-only consumers; later background propagation needs an explicit design.

`configureApp()` must run immediately after factory creation and before `init()`/`listen()`. Inspection of installed `@nestjs/core/nest-application.js` confirms default Express parsers register during `init()`, before module middleware. Early `app.use()` establishes correlation/logging before those parsers. Default parser protection is retained (Express JSON/urlencoded default 100kb); malformed JSON gets 400 and oversized bodies get 413. Node HTTP parser failures before Express receives a request are outside this application pipeline.

Completion records contain timestamp, severity, `sportify-api`, `http.request.completed`, request ID, method, matched route template (or `unmatched`), response status, monotonic duration in milliseconds and `completed`/`aborted` outcome. Finish/close listeners share a one-shot guard and remove each other. An aborted response with no sent headers has status `null`; an already-started response retains its status. Detection of a disconnected client does not automatically cancel future application work. No load-balancer draining is implemented.

Logs use JSON stdout through one small logger with an injectable record sink. A failing sink cannot alter the response and has no unsafe exception-dumping fallback. See [error/logging policy](errors.md). Health logs contain the same minimal fields, without dependency/configuration details.

## Runtime DTO validation

The global `DtoValidationPipe` uses existing Zod 4.6.7. DTO classes expose a `static schema = z.strictObject({...})`; decorated parameters must reference that concrete class so emitted runtime metadata can identify it. Define `z.strictObject` at every fixed nested object. Return the parsed data; fields must match the DTO's TypeScript declarations. Interfaces alone are erased and do not validate incoming JSON. Primitive/unannotated parameters are not automatically DTO-validated.

Use fixed, authored field names and arrays of fixed shapes for public DTOs. Do not use arbitrary client-keyed records or input-derived custom issue paths in public error details. Dynamic key payloads need a reviewed redaction/path policy first. Unknown keys are rejected; the public issue identifies the containing object, without echoing the unknown key. There is no broad implicit conversion: `z.boolean()` rejects the string `"false"`. Any string-to-number/query conversion must be explicitly defined, including syntax and bounds; avoid unconstrained `z.coerce.boolean()`.

Validation returns 400 `VALIDATION_ERROR`. Details contain only stable codes, authored generic messages and bounded field paths: at most 20 details, eight path segments and 160 characters per path. Arrays use dotted indices such as `items.0.count`. The path formatter traverses the input schema and retains only known object fields/array indices. Arbitrary record keys, unsupported schema paths and unsafe/overlong segments become `*`. Submitted values, full targets and Zod/custom validator messages are never forwarded. Request-size limits bound input separately from output detail limits.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [
      { "field": "nested.count", "code": "INVALID_VALUE", "message": "Provide a valid value." }
    ]
  },
  "requestId": "4b68fda1-4273-4aca-b3e0-6a0b7b154351"
}
```

This example is exercised by a test-only DTO/controller. No production validation-demo endpoint exists. Input shape is separate from business rules and authorization. Client tenant IDs never establish authorization or tenant scope.

References consulted: [Nest interceptors](https://docs.nestjs.com/interceptors), [pipes and schema validation](https://docs.nestjs.com/pipes), [middleware ordering](https://docs.nestjs.com/middleware), [exception filters](https://docs.nestjs.com/exception-filters), and installed version-specific core/Express adapter source. Tests demonstrate the ordering and response semantics for the pinned versions.
