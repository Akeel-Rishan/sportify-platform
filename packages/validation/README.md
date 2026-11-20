# @sportify/validation

Browser-safe Zod validation primitives: the Node environment enum, typed parsing helper and safe EnvironmentError. Environment input is injected; this package never reads process.env or local files. Per-application schemas define only currently used variables. All returned error explanations are authored rules rather than serialized supplied values.

Browser-safe only. Never import application code, runtime server configuration or secrets. Explicit exports resolve compiled JavaScript and declarations; build before consumption. Add workspace:* dependencies only when a consumer actually needs them.
