# Step 12 account API

These routes implement the account portion of API §§2.4 and 4.1. Paths keep their existing names. Login and current-account responses narrow the earlier proposed payload to the public account ID, full name and confirmed email status. Tenant selection, roles, permissions and platform administration have independent contracts. [Original API contract](../SPORTIFY_API_Contract_Package_v1.0/SPORTIFY_API_Specification_v1.0.md)

| Route under `/api/v1`        | Input                               | Success                                                                                |
| ---------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| `GET /auth/csrf`             | `X-CSRF-Bootstrap: 1`               | `200`, `{ csrfToken }`                                                                 |
| `POST /auth/login`           | `{ email, password }`               | `200`, `{ account: { publicId, fullName, emailVerified: true } }` and a session cookie |
| `GET /auth/me`               | Session cookie                      | `200`, same account shape                                                              |
| `POST /auth/logout`          | Current session cookie when present | `204`, clears browser cookies                                                          |
| `POST /auth/forgot-password` | `{ email }`                         | `202`, `{ status: "accepted" }`                                                        |
| `POST /auth/reset-password`  | `{ token, password }`               | `200`, `{ status: "reset" }`                                                           |

All POSTs require the exact dashboard Origin and a CSRF proof. JSON success and error responses retain the existing envelope and request ID. Responses use `Cache-Control: no-store`. Strict JSON bodies reject extra authority fields. `/auth/me` returns a safe `401` for missing, expired or revoked sessions. [Browser protocol](browser-security.md)

Login uses the registration email rules and accepts only an `ACTIVE` user with a verified email and at least one active business membership. The principal carries no tenant context. Unknown, unverified, disabled, locked and wrong-password accounts share a generic `401 UNAUTHENTICATED`. A dummy Argon2id verification covers absent or malformed credentials. Verification is limited to the approved Step 11 PHC work factor and salt/digest sizes. The process-wide two-task bound applies across login, registration and reset. Timing can still vary due to database and system load. [Password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

Oracle locks and rechecks the account and the original password hash after verification. The transaction stores the new session digest and audit together. The response attaches the cookie after commit. A fresh login from a different browser preserves other sessions. Reauthenticating with a valid current cookie for the same user rotates that device's session.

Logout takes the account lock and revokes only the current live dashboard session. It records an audit entry once per actual revocation. A CSRF-protected retry is idempotent. After the cookies are cleared, refresh the CSRF proof before retrying. Oracle failure clears the local cookies and returns an error. Only a successful response confirms server-side revocation. Requests previously authorized may finish. [Session and revocation rules](server-side-sessions.md)
