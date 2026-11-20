# @sportify/api-contracts

Shared transport contracts: `ApiSuccess<T>`, `ApiErrorResponse`, `ApiResponse<T>`, `ValidationIssue`, stable error codes, and health/readiness payloads. Business request/response contracts remain subject to reconciliation.

Browser-safe only. Never import application code, runtime server configuration or secrets. Explicit exports resolve compiled JavaScript and declarations; build before consumption. Add workspace:* dependencies only when a consumer actually needs them.
