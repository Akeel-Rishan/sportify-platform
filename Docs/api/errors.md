# Safe API errors

The global exception filter returns `ApiErrorResponse` and never forwards arbitrary exception messages, bodies, stacks, paths, SQL, credentials or third-party details. Existing response protocol headers are retained; errors add `Cache-Control: no-store` and JSON content type. HEAD errors have no body. If headers have already been sent, the filter logs an unexpected failure safely and does not write again.

| HTTP | Stable code             | Public message                                         |
| ---- | ----------------------- | ------------------------------------------------------ |
| 400  | BAD_REQUEST             | The request could not be processed.                    |
| 400  | VALIDATION_ERROR        | The request contains invalid fields.                   |
| 401  | UNAUTHENTICATED         | Authentication is required.                            |
| 403  | FORBIDDEN               | You do not have permission to perform this action.     |
| 404  | NOT_FOUND               | The requested resource was not found.                  |
| 405  | METHOD_NOT_ALLOWED      | This method is not allowed.                            |
| 409  | CONFLICT                | The request conflicts with the current resource state. |
| 413  | PAYLOAD_TOO_LARGE       | The request body is too large.                         |
| 415  | UNSUPPORTED_MEDIA_TYPE  | This media type is not supported.                      |
| 422  | BUSINESS_RULE_VIOLATION | The request does not satisfy the required rules.       |
| 429  | RATE_LIMITED            | Too many requests. Try again later.                    |
| 500  | INTERNAL_ERROR          | An unexpected error occurred.                          |
| 503  | SERVICE_UNAVAILABLE     | The service is temporarily unavailable.                |

Supported framework `HttpException` statuses in 400–599 are retained. Unlisted 4xx statuses use the safe BAD_REQUEST code/message; unlisted 5xx use INTERNAL_ERROR. Invalid exception statuses are normalized to 500. Exact Express parser error categories are allowlisted for 400/413/415; arbitrary objects with a `status` property are not trusted as public HTTP errors. No adapter-generated 405/415 guarantee or global content-type rejection policy is introduced. Normal bodyless GETs remain valid.

## Application errors and validation details

`new ApplicationError('CONFLICT')` selects an approved message/status from the server catalogue. It does not accept arbitrary public text or third-party exceptions. Required authored protocol values can be supplied with the restricted `Allow`, `Retry-After` and `WWW-Authenticate` header options; values containing CR/LF or over 256 characters are discarded. Do not pass user-controlled data as protocol headers. Existing headers, such as an explicitly set challenge/retry header, are not replaced by a generic error envelope.

To add an application error: review its stable public code, HTTP status and safe message; add the framework-independent code in api-contracts and its server catalogue entry; add tests for status, redaction and any protocol headers. Only the DTO validation mechanism supplies public `details`; it uses the [bounded safe format](conventions.md#runtime-dto-validation). Do not create a domain exception hierarchy before a real workflow requires it.

Unexpected error example:

```json
{
  "success": false,
  "error": { "code": "INTERNAL_ERROR", "message": "An unexpected error occurred." },
  "requestId": "4b68fda1-4273-4aca-b3e0-6a0b7b154351"
}
```

Codes are stable identifiers for future localized English, Sinhala and Tamil frontend messages. Public English text is a safe default, not a translation framework. Never localize by displaying raw backend exception text.

## Safe logging

Unexpected failures emit `http.request.error` with timestamp, severity, service, request ID and a fixed classification (`unexpected_exception` or `http_server_error`). They never serialize the error object, message, name, cause or stack. A distinct completion record supplies the final HTTP outcome. Known application unavailability does not invent private dependency details.

Request logs contain only the allowlisted [completion fields](conventions.md#request-ids-and-logging). Route parameters, raw URLs, queries, bodies, authorization, cookies, session tokens, environment objects and customer identities are omitted. No tenant/user identity exists at this stage. Error and completion records correlate through the same server-owned request ID. Tests inject secret sentinels into requests and exceptions and inspect captured structured records without reading console output.

Restricted diagnostic logging may be added in a future explicit change with reviewed redaction, access controls, retention, opt-in behavior and tests. The default logger must remain safe; enabling an environment mode must not silently dump exceptions. No external logging service or security-audit certification is part of Step 04.
