# SPORTIFY – Complete API Specification & OpenAPI Contract

**Document version:** 1.0  
**Date:** 15 November 2026  
**Product:** SPORTIFY – Multi-Tenant Indoor Sports Booking & Business Management SaaS  
**Initial market:** Sri Lanka  
**API version:** v1  
**Base path:** `/api/v1`  
**Specification format:** OpenAPI 3.1.0 (YAML)  
**Status:** Engineering contract – implementation approval required

---

## 1. Purpose and source baseline

This document translates the approved product and engineering baseline into a contract shared by the Next.js frontend, NestJS backend, QA and integration work.

### 1.1 Source documents

1. SPORTIFY Master Product Requirements Document (PRD) v1.0.
2. SPORTIFY MVP Scope & Business Workflow Specification v1.0.
3. SPORTIFY Technical Architecture Specification v1.0.
4. SPORTIFY Complete Oracle Database Schema Specification & ERD v1.0 and `001_sportify_schema.sql`.
5. SPORTIFY UX Research, User Flows & Wireframes v1.0.

### 1.2 Contract authority

- The MVP Specification determines what is active in the first release.
- The Technical Architecture determines the REST base path, modular-monolith approach, authentication direction, security controls and module boundaries.
- The Oracle schema determines data relationships, status values, tenant-aware keys and transaction integrity.
- The UX/Wireframes determine the user journeys and the information/actions required on each MVP screen.
- Broader PRD capabilities that are explicitly excluded from MVP are not exposed as active v1 endpoints.

Where a requirement is absent or conflicts between source documents, this contract records an implementation decision or a blocker instead of silently inventing a product rule.

### 1.3 API scope

Included:
- Authentication, registration, email verification and staff invitation acceptance.
- Tenant context and role-based authorization.
- Business profile, onboarding, sports, branches, facilities/resources, schedules, holidays, availability blocks and pricing.
- Public tenant website resolution and guest booking.
- Availability, temporary holds, booking confirmation and manual bookings.
- Booking management, cancellation, completion and no-show.
- Customer directory.
- Manual venue payment receipts and manual refunds.
- Staff and branch assignments.
- Website settings, media and publishing.
- Basic business reports.
- Subscription visibility and Super Admin tenant/plan administration.
- Health and readiness endpoints.

Not active in v1:
- Central marketplace and reviews.
- Custom domains and domain verification.
- Online payment gateways, payment webhooks and automated refunds.
- Payment splitting and automated recurring payments.
- Recurring bookings.
- Customer accounts/self-service cancellation and customer booking history.
- SMS/WhatsApp automation.
- Advanced drag-and-drop website builder, multiple advanced themes and native mobile applications.

---

## 2. API conventions

### 2.1 Servers and content types

Production base URL:

```text
https://api.sportify.lk/api/v1
```

Staging should use a separate hostname and database. Tenant booking websites use verified SPORTIFY subdomains, for example:

```text
https://colombofutsal.sportify.lk
```

- Request and response media type: `application/json; charset=utf-8`.
- Media upload: `multipart/form-data`.
- JSON property names: `camelCase`.
- API paths: plural resource names where appropriate.
- All endpoints are versioned under `/api/v1`.
- HTTPS is mandatory.

### 2.2 Success and error envelopes

Successful response:

```json
{
  "success": true,
  "data": {
    "bookingReference": "SPT-2026-000001",
    "bookingStatus": "CONFIRMED",
    "paymentStatus": "UNPAID"
  },
  "requestId": "01J...REQUEST"
}
```

Error response:

```json
{
  "success": false,
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "The selected time is no longer available.",
    "details": [
      {
        "field": "localStart",
        "reason": "The requested slot was reserved by another transaction."
      }
    ]
  },
  "requestId": "01J...REQUEST"
}
```

Never return Oracle errors, SQL text, stack traces, secrets, token hashes or internal infrastructure details.

### 2.3 Request IDs and tracing

- The server generates a unique `requestId` for every request.
- Accept an optional `X-Request-ID` from trusted internal callers only; validate length and characters.
- Return the final ID in the response envelope and `X-Request-ID` response header.
- Include request ID, service, operation, actor and tenant (when applicable) in structured JSON logs.
- Do not log passwords, cookies, CSRF tokens, hold tokens, invitation tokens, reset tokens, wallet contents or full customer payment details.

### 2.4 Authentication model

Use server-side sessions, not long-lived browser-stored bearer tokens.

- Session cookie: `sportify_session`.
- Cookie attributes: `Secure`, `HttpOnly`, `SameSite=Lax`, host-only where practical, and a path restricted to the application.
- The database stores only a hash of the random session token in `AUTH_SESSIONS`.
- Rotate the session after successful login, password reset and privilege-sensitive changes.
- Revoke the session on logout, account deactivation, membership revocation or security lockout.
- Login, password reset and invitation tokens are one-time and stored hashed.
- Passwords are hashed with Argon2id. The OpenAPI file currently proposes a minimum 12-character password; confirm this threshold in the security decision register before implementation.
- MFA is not an MVP requirement.

Cookie-authenticated state-changing requests require a valid CSRF token in `X-CSRF-Token`. `GET /auth/csrf` issues/refreshes the CSRF token. Public guest booking endpoints do not use the business dashboard session cookie; they use a high-entropy hold token for checkout ownership.

### 2.5 Tenant context

Tenant context is trusted only when resolved server-side:

1. **Business dashboard:** the active tenant is derived from the authenticated user's active `TENANT_USERS` membership and validated role/branch assignments.
2. **Tenant website:** the backend resolves the verified request hostname to the tenant's published `WEBSITE_SETTINGS.SUBDOMAIN_SLUG`.
3. **Multiple memberships:** `POST /auth/active-tenant` accepts a tenant public ID only as a selection hint; the backend must verify an active membership before changing the server-side session context.

A browser-supplied `tenantId`, `businessId`, role, permission or branch list is never proof of authorization. Tenant identity must not be accepted from arbitrary query/body fields.

Every tenant-owned repository call must include `TENANT_ID`. Composite tenant-aware foreign keys remain the database-level relationship guard. VPD/application context may be added as defense in depth only after pooled-session context lifecycle testing; it does not replace application filtering.

For cross-tenant resource identifiers, return `404 NOT_FOUND` rather than disclosing that another tenant's record exists.

### 2.6 Identifier policy – schema alignment blocker

The API contract uses opaque UUID-style public identifiers for tenant-owned entities. The current schema already has public IDs for tenants, users, customers, booking holds and bookings, but several API-addressable tables in `001_sportify_schema.sql` expose only numeric identity keys (including locations, resources, tenant memberships/invitations, pricing rules, availability blocks, holidays, payments, refunds, website media and website settings).

**Required before implementation:** add tenant-scoped `PUBLIC_ID VARCHAR2(36)` columns with unique constraints to every tenant-owned entity exposed through a URL or browser-facing response, or document and approve an equivalent non-sequential opaque identifier strategy. Do not expose raw Oracle identity values as public API IDs.

Use stable codes where they already exist:
- Sports: `sportCode`.
- Subscription plans: `planCode`.
- Booking display/reference: `bookingReference` (not an authorization secret).

Internal numeric keys remain private to the backend.

### 2.7 Date, time and currency conventions

- API instants use RFC 3339 UTC, e.g. `2026-11-20T13:30:00Z`.
- Booking selection uses venue-local wall time: `localStart` in `YYYY-MM-DDTHH:mm` format. The server obtains the IANA timezone from the selected location and converts to UTC.
- Never trust the browser's timezone as the venue timezone.
- Return both UTC instants and venue-local display values plus `timeZone`.
- Database `*_UTC` columns use `TIMESTAMP(6)` without time zone under a strict UTC convention. Every new pooled DB session must execute `ALTER SESSION SET TIME_ZONE = 'UTC'`.
- ISO weekday numbering: Monday = 1 through Sunday = 7.
- `openMinute` and `closeMinute` are minutes after midnight; close minute may be 1440.
- Currency uses ISO 4217 three-letter codes; initial Sri Lankan default is `LKR`.
- Monetary values are serialized as decimal strings with up to two decimal places to avoid JavaScript floating-point errors. Oracle stores them as `NUMBER(12,2)`.

### 2.8 Pagination and filtering

List endpoints use:
- `page`: 1-based integer, default 1.
- `pageSize`: integer, default 20, maximum 100.
- `q`: optional search string.
- `sort`: endpoint-approved field and direction only.

Paginated `data`:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

Date filters use `from` and `to` RFC 3339 instants unless an endpoint explicitly requires a venue-local `date`.

### 2.9 Idempotency

`Idempotency-Key` is mandatory for:
- `POST /public/booking-holds`
- `POST /public/bookings`
- `POST /bookings/manual`
- `POST /bookings/{bookingId}/payments`
- `POST /payments/{paymentId}/refunds`
- `POST /admin/subscription-invoices/{invoiceNumber}/payments`

Requirements:
1. Accept a random client-generated key of 8–160 characters.
2. Scope it to tenant + operation; for guest operations, resolve tenant from hostname first.
3. Store a request fingerprint and the original result in `IDEMPOTENCY_KEYS`.
4. Same key + same request fingerprint returns the original status/body and must not repeat side effects.
5. Same key + different request fingerprint returns `409 IDEMPOTENCY_KEY_REUSED`.
6. Concurrent identical requests must not create duplicate records.
7. Retention is a server configuration and must be documented in the deployment runbook; the source schema does not prescribe a fixed TTL.

### 2.10 HTTP status codes

| Status | Meaning | Typical use |
|---|---|---|
| 200 | OK | Reads and successful actions |
| 201 | Created | New tenant, resource, hold, booking, receipt |
| 202 | Accepted | Email/reset request queued |
| 204 | No Content | Successful deactivation/revocation with no response body |
| 400 | Bad Request | Malformed JSON or invalid query syntax |
| 401 | Unauthorized | Missing/invalid/expired session or token |
| 403 | Forbidden | Authenticated actor lacks permission |
| 404 | Not Found | Missing or cross-tenant resource |
| 409 | Conflict | Slot conflict, duplicate, stale state or idempotency conflict |
| 422 | Unprocessable Entity | Valid syntax but failed business rule |
| 429 | Too Many Requests | Rate limit or abuse protection |
| 500 | Internal Server Error | Unexpected server failure; no internal detail exposed |
| 503 | Service Unavailable | Dependency not ready or temporary service outage |

---

## 3. RBAC and permission contract

### 3.1 MVP business roles

The MVP uses three core tenant roles:

- `BUSINESS_OWNER`
- `BUSINESS_MANAGER`
- `RECEPTIONIST`

The broader PRD includes additional business roles and custom permissions, but they are not active MVP roles unless separately approved and configured.

### 3.2 Seeded permission codes

The Oracle schema seeds these permission codes:

| Permission code | Meaning |
|---|---|
| `business.read` | View business profile/settings |
| `business.manage` | Edit business profile/settings |
| `location.read` | Read branches within assigned scope (add by migration) |
| `location.manage` | Create/update/deactivate branches and schedules |
| `resource.read` | Read resources, schedules, pricing and blocks within assigned scope (add by migration) |
| `resource.manage` | Manage resources, availability blocks and pricing |
| `booking.read` | View bookings within branch scope |
| `booking.create` | Create manual bookings |
| `booking.cancel` | Cancel bookings with reason |
| `payment.read` | View receipts/payment summaries |
| `payment.record` | Record venue receipts |
| `staff.manage` | Invite/update/deactivate staff and assignments |
| `report.read` | View business reports |
| `website.manage` | Edit media/settings and publish website |
| `subscription.read` | View own plan, trial, usage and expiry |
| `subscription.manage` | Reserved for approved subscription administration policy |

### 3.3 Additional permission codes required

The seeded list does not explicitly cover every action in the MVP API. Add these codes through a reviewed database migration before enabling the associated routes:

- `location.read`
- `resource.read`
- `customer.read`
- `customer.manage`
- `booking.manage` – complete/no-show state transitions.
- `payment.refund` – manual refund recording.
- `schedule.manage` – optional if schedule/holiday changes are separated from `location.manage`.
- `platform.tenants.manage` (Super Admin policy)
- `platform.sports.manage` (Super Admin policy)
- `platform.subscriptions.manage` (Super Admin policy)
- `platform.audit.read` (Super Admin policy)
- `platform.statistics.read` (Super Admin policy)

The `platform.*` values above are API guard policy identifiers for the MVP Super Admin allowlist. They are not rows in the tenant `PERMISSIONS`/`ROLE_PERMISSIONS` model. The current schema has `PLATFORM_ADMINS.ADMIN_ROLE_CODE`; if granular Platform Administrator or Support Agent permissions are enabled later, add a separate platform permission mapping model. In v1, these admin endpoints are Super Admin only.

### 3.4 Default MVP role matrix

| Capability | Owner | Manager | Receptionist |
|---|---:|---:|---:|
| Business read/update | Yes | Read; update only if granted | No |
| Branch/resource/schedule/pricing management | Yes | Yes, within assigned scope | No |
| View bookings | All branches | Assigned branches | Assigned branches |
| Create manual bookings | Yes | Yes | Yes |
| Cancel bookings | Yes | Yes | Only if `booking.cancel` granted |
| Complete/no-show | Yes | Yes | Only if `booking.manage` granted |
| View customers | Yes | Yes, within branch/business scope | Operational lookup only |
| Record venue payments | Yes | Yes | Yes |
| Record refunds | Yes | Yes if granted | No by default |
| Manage staff | Yes | Only if granted | No |
| Website settings/publish | Yes | Only if granted | No |
| Basic reports | Yes | Yes | Restricted/summary only |
| View own subscription | Yes | Only if granted | No |
| Manage platform tenants/plans/sports | No | No | No |

Business Owner receives all business permissions. Business Manager receives operational permissions according to the approved role mapping and branch assignment. Receptionist receives booking, payment, location/resource read and limited customer permissions. `location.read` and `resource.read` must be added to the seeded permission catalogue because the current SQL bootstrap does not include them. Do not infer permissions from role labels in frontend code; check permission codes in the backend on every request.

### 3.5 Platform roles

The schema supports `SUPER_ADMIN`, `PLATFORM_ADMIN` and `SUPPORT_AGENT`. MVP Super Admin routes require an active `SUPER_ADMIN` record. Platform Administrator and Support Agent access must be explicitly scoped; neither role automatically receives unrestricted tenant financial/customer access. Support access to sensitive tenant data must be separately authorized and audited.

### 3.6 Branch scope

- Owner: all active business branches.
- Manager: branches assigned to that membership, unless owner-approved broader scope is configured.
- Receptionist: assigned branches only.
- A branch-scoped request must validate that the requested location/resource/booking/payment belongs to an assigned location.
- List endpoints must filter before pagination and counting.
- A user must not be able to broaden scope by changing a `locationId` query parameter.

---

## 4. Endpoint catalogue

The complete machine-readable contract is `openapi.yaml` in this package. The following catalogue explains the v1 surface.

Legend: **Public** = no business session; **Session** = authenticated tenant session; **Platform** = Super Admin; **Idempotent** = `Idempotency-Key` required.

### 4.1 System and authentication

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Liveness |
| GET | `/ready` | Public | Readiness without exposing secrets |
| GET | `/auth/csrf` | Public | Issue/refresh CSRF token |
| POST | `/auth/register` | Public | Register owner and initialize tenant/onboarding |
| POST | `/auth/login` | Public | Authenticate and set secure session cookie |
| POST | `/auth/logout` | Session + CSRF | Revoke current session |
| POST | `/auth/verify-email` | Public | Consume one-time verification token |
| POST | `/auth/verification/resend` | Public | Resend verification message |
| POST | `/auth/forgot-password` | Public | Request password reset |
| POST | `/auth/reset-password` | Public | Consume reset token and set password |
| GET | `/auth/me` | Session | Current user, memberships, active tenant and permissions |
| POST | `/auth/active-tenant` | Session + CSRF | Select a tenant after membership validation |
| POST | `/auth/invitations/accept` | Public | Accept staff invitation and create/link membership |

`POST /auth/register` creates the owner identity and tenant provisioning baseline, validates required business registration details, creates the owner membership/role and starts onboarding. Email verification is required before normal dashboard access. The implementation transaction must follow the database provisioning sequence.

### 4.2 Public tenant website and sports

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/public/site` | Public, hostname-resolved | Published business website payload |
| GET | `/sports` | Public | Active global sports catalog |
| GET | `/public/availability` | Public, hostname-resolved | Public availability by venue-local date and filters |

`GET /public/site` is a contract-completion endpoint derived from the customer tenant-home wireframe. It must resolve the tenant from the verified host, return only published/public fields and reject unknown or unpublished hosts.

### 4.3 Business profile and onboarding

| Method | Endpoint | Permission | Purpose |
|---|---|---|---|
| GET | `/business` | `business.read` | Read business and public profile |
| PATCH | `/business` | `business.manage` | Update business/profile fields |
| GET | `/business/settings` | `business.read` | Read tenant currency/timezone/language settings |
| PATCH | `/business/settings` | `business.manage` | Update supported tenant defaults |
| GET | `/onboarding/progress` | `business.read` | Read saved wizard progress |
| PUT | `/onboarding/progress/{stepCode}` | `business.manage` | Upsert one wizard step |

### 4.4 Sports, branches, resources and schedules

| Method | Endpoint | Permission | Purpose |
|---|---|---|---|
| GET | `/business/sports` | `business.read` | Sports enabled by tenant |
| POST | `/business/sports` | `business.manage` | Enable a global sport |
| DELETE | `/business/sports/{sportCode}` | `business.manage` | Disable a tenant sport when safe |
| GET/POST | `/locations` | `business.read` / `location.manage` | List/create branches |
| GET/PATCH/DELETE | `/locations/{locationId}` | `business.read` / `location.manage` | Read/update/deactivate branch |
| GET | `/locations/{locationId}/operating-hours` | `business.read` | Read weekly hours |
| PUT | `/locations/{locationId}/operating-hours` | `location.manage` | Replace weekly hours for branch/resource scope |
| GET/POST | `/locations/{locationId}/holidays` | `business.read` / `location.manage` | List/create holidays |
| PATCH/DELETE | `/locations/{locationId}/holidays/{holidayId}` | `location.manage` | Update/deactivate holiday |
| GET/POST | `/resources` | `business.read` / `resource.manage` | List/create facilities/resources |
| GET/PATCH/DELETE | `/resources/{resourceId}` | `business.read` / `resource.manage` | Read/update/deactivate resource |
| GET | `/resources/{resourceId}/pricing-rules` | `business.read` | Read hourly price rules |
| POST | `/resources/{resourceId}/pricing-rules` | `resource.manage` | Create price rule |
| PATCH/DELETE | `/resources/{resourceId}/pricing-rules/{pricingRuleId}` | `resource.manage` | Update/deactivate price rule |
| GET | `/availability/blocks` | `business.read` | List maintenance/closure blocks |
| POST | `/availability/blocks` | `resource.manage` | Create block after conflict checks |
| DELETE | `/availability/blocks/{blockId}` | `resource.manage` | Cancel a block |
| GET | `/resources/{resourceId}/availability` | `booking.read` | Dashboard availability for one resource |

Schedule, holiday, pricing and block routes are contract-completion routes needed by the approved onboarding and facility-management UX. They use the existing `OPERATING_HOURS`, `HOLIDAYS`, `PRICING_RULES` and `AVAILABILITY_BLOCKS` tables.

### 4.5 Booking and customer operations

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/public/booking-holds` | Public + Idempotent | Atomically hold requested 15-minute slots |
| POST | `/public/bookings` | Public + Idempotent | Convert valid hold to confirmed guest booking |
| POST | `/public/booking-holds/{holdId}/release` | Public, hold token | Voluntarily release own hold |
| GET | `/bookings` | `booking.read` | Paginated booking list with filters |
| GET | `/bookings/{bookingId}` | `booking.read` | Booking detail |
| POST | `/bookings/manual` | `booking.create` + Idempotent | Create staff booking using same reservation service |
| POST | `/bookings/{bookingId}/cancel` | `booking.cancel` | Cancel upcoming booking with reason |
| POST | `/bookings/{bookingId}/complete` | `booking.manage` | Mark completed |
| POST | `/bookings/{bookingId}/no-show` | `booking.manage` | Mark no-show |
| GET/POST | `/customers` | `customer.read` / `customer.manage` | Search/list/create tenant customer |
| GET/PATCH | `/customers/{customerId}` | `customer.read` / `customer.manage` | Read/update customer |

Guest confirmation returns a booking confirmation once. A booking reference alone is not a credential and must not permit later retrieval of customer data. Customer self-service lookup/cancellation is excluded from v1.

### 4.6 Venue payment management

| Method | Endpoint | Permission | Purpose |
|---|---|---|---|
| GET | `/business/payment-settings` | `payment.read` | Read enabled venue payment preferences and transfer instructions |
| PATCH | `/business/payment-settings` | `business.manage` | Configure cash/bank transfer/card-at-venue acceptance |
| GET | `/payments` | `payment.read` | List venue payment receipts |
| GET | `/bookings/{bookingId}/payments` | `payment.read` | List booking receipts |
| POST | `/bookings/{bookingId}/payments` | `payment.record` + Idempotent | Record a manual receipt |
| POST | `/payments/{paymentId}/refunds` | `payment.refund` + Idempotent | Record a manual refund |

Supported venue receipt methods must match the database constraint: `CASH`, `BANK_TRANSFER`, `CARD_AT_VENUE`, `OTHER`. A payment receipt does not confirm or cancel a booking. Booking and payment status are separate.

### 4.7 Staff management

| Method | Endpoint | Permission | Purpose |
|---|---|---|---|
| GET | `/staff` | `staff.manage` | List tenant staff and branch assignments |
| POST | `/staff/invite` | `staff.manage` | Invite email, role and branch scope |
| PATCH | `/staff/{membershipId}` | `staff.manage` | Update role and branch assignments |
| POST | `/staff/{membershipId}/deactivate` | `staff.manage` | Revoke/deactivate membership and sessions |
| POST | `/staff/invitations/{invitationId}/revoke` | `staff.manage` | Revoke pending invitation |

### 4.8 Website and reports

| Method | Endpoint | Permission | Purpose |
|---|---|---|---|
| GET | `/website/settings` | `business.read` | Read website settings |
| PATCH | `/website/settings` | `website.manage` | Update supported content/branding |
| GET | `/website/media` | `website.manage` | List media metadata |
| POST | `/website/media` | `website.manage` | Upload validated media to Object Storage |
| POST | `/website/publish` | `website.manage` | Validate setup and publish/update subdomain |
| GET | `/reports/overview` | `report.read` | Dashboard KPI summary |
| GET | `/reports/bookings` | `report.read` | Daily/weekly/monthly booking totals |
| GET | `/reports/revenue` | `report.read` | Booking value and collected payments by branch/resource/sport |

### 4.9 Subscription and Super Admin

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/subscriptions/current` | `subscription.read` | Current plan/status/dates |
| GET | `/subscriptions/plans` | Session | Active plan catalogue |
| GET | `/subscriptions/usage` | `subscription.read` | Current usage versus entitlements |
| GET | `/admin/statistics` | Super Admin | Platform-level statistics |
| GET | `/admin/tenants` | Super Admin | Search/filter tenants |
| GET | `/admin/tenants/{tenantId}` | Super Admin | Tenant details |
| POST | `/admin/tenants/{tenantId}/suspend` | Super Admin | Suspend tenant with reason |
| POST | `/admin/tenants/{tenantId}/reactivate` | Super Admin | Reactivate tenant with reason |
| GET/POST | `/admin/sports` | Super Admin | List/create global sports |
| PATCH | `/admin/sports/{sportCode}` | Super Admin | Update global sport |
| POST | `/admin/sports/{sportCode}/deactivate` | Super Admin | Deactivate global sport |
| GET | `/admin/subscriptions` | Super Admin | Search subscriptions |
| GET/POST | `/admin/subscription-plans` | Super Admin | List/create plans |
| PATCH | `/admin/subscription-plans/{planCode}` | Super Admin | Update plan/entitlements |
| POST | `/admin/tenants/{tenantId}/subscription/assign` | Super Admin | Assign plan and dates |
| POST | `/admin/tenants/{tenantId}/subscription/extend-trial` | Super Admin | Extend trial with reason |
| POST | `/admin/subscription-invoices/{invoiceNumber}/payments` | Super Admin + Idempotent | Record manual SaaS subscription payment |
| GET | `/admin/audit-logs` | Super Admin | Read protected audit events |

The `/admin` routes are platform routes, not tenant routes. They must never inherit the active business tenant as their authorization boundary.

---

## 5. Request and response schemas

The canonical, complete JSON Schema definitions are in `openapi.yaml`. This section records the most important payloads and their business meaning.

### 5.1 Registration

`POST /auth/register`

```json
{
  "businessName": "Colombo Futsal Arena",
  "ownerName": "Example Owner",
  "email": "owner@example.lk",
  "mobile": "+94770000000",
  "password": "A-long-unique-password",
  "businessLocation": {
    "addressLine1": "Example Road",
    "city": "Colombo",
    "district": "Colombo",
    "countryCode": "LK"
  },
  "primarySportCode": "FUTSAL"
}
```

Validation:
- Business name and owner name required.
- Email must be normalized and unique.
- Mobile must be valid E.164.
- Password must meet the configured password policy.
- Primary sport must be active.
- Registration must not accept tenant ID, role, permission, subscription status or owner membership ID from the client.
- Registration must create the owner/tenant relationship atomically or leave a recoverable, non-login pending registration state.
- Email verification is required before dashboard access.

### 5.2 Login

`POST /auth/login`

```json
{
  "email": "owner@example.lk",
  "password": "A-long-unique-password"
}
```

Response sets `sportify_session` as a secure HttpOnly cookie. The JSON response returns the user summary, memberships and active tenant context, but never the session token or password hash.

### 5.3 Resource creation

`POST /resources`

```json
{
  "locationId": "b3c1a4c0-1e7c-4c3b-9f18-000000000001",
  "sportCode": "FUTSAL",
  "resourceCode": "COURT-01",
  "resourceName": "Futsal Court 01",
  "resourceType": "COURT",
  "description": "Indoor futsal court",
  "capacity": 12,
  "minimumDurationMinutes": 60,
  "maximumDurationMinutes": 180,
  "advanceBookingDays": 30,
  "bufferBeforeMinutes": 0,
  "bufferAfterMinutes": 0,
  "isBookable": true
}
```

The server enforces the 15-minute grid. `slotIntervalMinutes` is not client-configurable in MVP and is always 15. The sport must already be enabled for the tenant.

### 5.4 Operating hours

`PUT /locations/{locationId}/operating-hours`

```json
{
  "resourceId": null,
  "entries": [
    { "dayOfWeek": 1, "isClosed": false, "openMinute": 480, "closeMinute": 1320 },
    { "dayOfWeek": 2, "isClosed": false, "openMinute": 480, "closeMinute": 1320 },
    { "dayOfWeek": 3, "isClosed": false, "openMinute": 480, "closeMinute": 1320 },
    { "dayOfWeek": 4, "isClosed": false, "openMinute": 480, "closeMinute": 1320 },
    { "dayOfWeek": 5, "isClosed": false, "openMinute": 480, "closeMinute": 1320 },
    { "dayOfWeek": 6, "isClosed": false, "openMinute": 480, "closeMinute": 1320 },
    { "dayOfWeek": 7, "isClosed": true, "openMinute": null, "closeMinute": null }
  ]
}
```

A `resourceId` of null means branch-level schedule. A resource-specific override uses that resource ID. Exactly one entry per weekday is allowed for the selected scope.

### 5.5 Public availability

`GET /public/availability?date=2026-11-20&resourceId=...&durationMinutes=60`

Tenant is resolved from the Host header. `date` is the venue-local calendar date. Availability must account for branch hours, resource hours, holidays, active blocks, confirmed bookings, active unexpired holds, buffer time and advance-booking rules.

### 5.6 Create a temporary hold

`POST /public/booking-holds`

Headers:
- `Idempotency-Key: <random-key>`

```json
{
  "resourceId": "b3c1a4c0-1e7c-4c3b-9f18-000000000001",
  "localStart": "2026-11-20T19:00",
  "durationMinutes": 60
}
```

Response includes:
- `holdId`
- one-time `holdToken` (raw token returned only to the caller; store only its hash)
- `expiresAtUtc`
- venue-local start/end and timezone
- hourly rate and calculated total snapshot
- currency

The countdown begins only after the server confirms the hold transaction committed.

### 5.7 Confirm a guest booking

`POST /public/bookings`

Headers:
- `Idempotency-Key: <random-key>`

```json
{
  "holdToken": "high-entropy-one-time-hold-token",
  "customer": {
    "fullName": "Example Customer",
    "mobile": "+94771111111",
    "email": "customer@example.lk"
  },
  "paymentPreference": "CASH_AT_VENUE",
  "bookingNotes": null
}
```

`paymentPreference` must be one of the methods enabled by the business: `CASH_AT_VENUE`, `BANK_TRANSFER` or `CARD_AT_VENUE`. This is a preference/instruction, not a payment receipt. The booking is automatically `CONFIRMED` after successful hold conversion and normally has `paymentStatus=UNPAID`.

### 5.8 Manual booking

`POST /bookings/manual`

Headers:
- authenticated session + CSRF
- `Idempotency-Key: <random-key>`

```json
{
  "resourceId": "b3c1a4c0-1e7c-4c3b-9f18-000000000001",
  "localStart": "2026-11-20T19:00",
  "durationMinutes": 60,
  "bookingSource": "WALK_IN",
  "customer": {
    "fullName": "Example Customer",
    "mobile": "+94771111111",
    "email": null
  },
  "bookingNotes": "Customer arrived at reception"
}
```

An existing `customerId` may be supplied instead of `customer`, never both. The server calculates price and creates the booking as confirmed/unpaid. A receipt is recorded separately through the payment endpoint. The same reservation service and slot uniqueness rules apply to online and manual bookings.

### 5.9 Cancellation

`POST /bookings/{bookingId}/cancel`

```json
{
  "reason": "Customer requested cancellation"
}
```

The server locks the booking, validates permission/branch scope and cancellable state, marks it cancelled, writes `BOOKING_CANCELLATIONS`, releases active slot rows and writes audit history in one transaction. Refunds are separate.

### 5.10 Record a venue payment receipt

`POST /bookings/{bookingId}/payments`

```json
{
  "paymentMethod": "CASH",
  "amount": "5000.00",
  "currencyCode": "LKR",
  "receivedAt": "2026-11-20T13:45:00Z",
  "paymentReference": null,
  "notes": "Paid at reception"
}
```

The receipt must not exceed the outstanding amount. `paymentStatus` is recalculated from valid receipts/refunds in the same transaction. Supported methods: `CASH`, `BANK_TRANSFER`, `CARD_AT_VENUE`, `OTHER`.

### 5.11 Record a manual refund

`POST /payments/{paymentId}/refunds`

```json
{
  "amount": "5000.00",
  "currencyCode": "LKR",
  "refundReason": "Venue approved cancellation refund"
}
```

This endpoint records a manual refund event; it does not initiate a gateway refund. The MVP payment-status vocabulary is `UNPAID`, `PAID`, `REFUNDED`. The schema contains a wider `PARTIALLY_PAID` / `PARTIALLY_REFUNDED` superset; those states must not be exposed as active MVP workflows unless the product owner approves a scope change.

### 5.12 Staff invitation

`POST /staff/invite`

```json
{
  "email": "reception@example.lk",
  "roleCode": "RECEPTIONIST",
  "locationIds": [
    "b3c1a4c0-1e7c-4c3b-9f18-000000000001"
  ]
}
```

Only the owner or a staff member with `staff.manage` can invite. The role must be one of the approved tenant roles. Every location must belong to the current tenant. The invitation token is sent out-of-band and stored only as a hash.

---

## 6. Detailed booking transaction contract

Booking integrity is the highest-priority API invariant.

### 6.1 Availability calculation

A slot is available only when all are true:
1. Branch is operating for the venue-local date/time.
2. Resource is active and bookable.
3. Branch and resource schedule allow the requested time.
4. No full/partial holiday closure applies.
5. No active maintenance/closure block overlaps.
6. No confirmed booking owns any required slot.
7. No active, unexpired hold owns any required slot.
8. Requested time follows the 15-minute grid.
9. Duration is within resource minimum/maximum and advance-booking rules.
10. Buffer rules do not conflict with another reservation.

Availability is advisory. The hold transaction is authoritative.

### 6.2 Hold creation transaction

`POST /public/booking-holds`

1. Resolve tenant from verified hostname; reject unknown/unpublished host.
2. Validate public booking settings and resource ownership under the resolved tenant.
3. Convert `localStart` using the location's IANA timezone.
4. Validate 15-minute alignment and duration.
5. Begin Oracle transaction.
6. Lock the resource row with `SELECT ... FOR UPDATE`.
7. Expire stale holds relevant to the requested resource/time range; delete their slot rows in the same transaction while preserving hold history.
8. Validate schedule, holiday, availability blocks, status, advance window, buffer and price.
9. Create `BOOKING_HOLDS` and `BOOKING_HOLD_ITEMS`.
10. Insert one `RESOURCE_SLOT_RESERVATIONS` row per 15-minute slot.
11. Persist idempotency result and transactional outbox/audit data where required.
12. Commit.
13. If any slot primary-key conflict occurs, roll back all changes and return `409 SLOT_UNAVAILABLE`.

Database final guard:

```sql
PRIMARY KEY (TENANT_ID, RESOURCE_ID, SLOT_START_UTC)
```

The slot row must reference exactly one of `BOOKING_ITEM_ID` or `HOLD_ITEM_ID`.

### 6.3 Booking confirmation transaction

`POST /public/bookings`

1. Resolve tenant from verified hostname.
2. Validate `holdToken` hash against the hold under the same tenant.
3. Begin Oracle transaction and lock the hold row using `SELECT ... FOR UPDATE`.
4. Verify hold is `ACTIVE` and not expired using database time.
5. Create/find tenant customer using normalized mobile/email policy.
6. Create `BOOKINGS` with `BOOKING_STATUS='CONFIRMED'`, `PAYMENT_STATUS='UNPAID'`, `BOOKING_SOURCE='ONLINE'`.
7. Create exactly one `BOOKING_ITEMS` row for MVP.
8. Transfer `RESOURCE_SLOT_RESERVATIONS.HOLD_ITEM_ID` to `BOOKING_ITEM_ID` atomically.
9. Mark hold `CONVERTED`.
10. Save customer snapshot, hourly-rate snapshot, duration, currency and total.
11. Write audit and notification/outbox intent.
12. Save idempotency response and commit.

Never release a hold and then create the booking in a separate transaction. There must be no unreserved gap.

### 6.4 Manual booking transaction

`POST /bookings/manual`

1. Resolve authenticated tenant and membership.
2. Verify `booking.create` and assigned branch scope.
3. Validate resource and customer under the same tenant.
4. Convert local time and validate duration/grid/schedule/blocks/price.
5. Begin transaction and lock resource.
6. Expire stale relevant holds.
7. Insert booking, customer (if new), booking item and all slot rows atomically.
8. Store `BOOKING_SOURCE` as `WALK_IN`, `PHONE`, `WHATSAPP` or `STAFF`.
9. Store creator membership and price snapshot.
10. Write audit/idempotency and commit.

No alternate manual-booking reservation path is permitted.

### 6.5 Cancellation transaction

1. Lock booking.
2. Validate tenant, branch scope, permission and booking status.
3. Require a non-empty cancellation reason.
4. Mark booking and item cancelled.
5. Insert one `BOOKING_CANCELLATIONS` row.
6. Delete only the active slot rows owned by the cancelled booking item.
7. Write audit/outbox.
8. Commit.

Do not delete the booking, customer or payment history. Refund recording is separate.

### 6.6 Completion and no-show

- Only a `CONFIRMED` booking can transition to `COMPLETED` or `NO_SHOW`.
- The action is authorized by `booking.manage`.
- These transitions preserve historical booking and payment data.
- Repeated identical terminal transition requests return the current booking; conflicting transitions return `409 BOOKING_STATE_CONFLICT`.

---

## 7. Validation rules

### 7.1 Global validation

- Reject unknown JSON properties on write DTOs unless explicitly allowed.
- Validate content type and request size.
- Normalize email to lowercase for uniqueness.
- Validate phone numbers in E.164 format.
- Trim user-entered names and descriptions.
- Validate URL schemes (`https` where public links are accepted).
- Use parameterized SQL/bind variables.
- Apply server-side validation even when the frontend validates.
- Reject negative or non-finite amounts.
- Enforce `NUMBER(12,2)` monetary range and two-decimal precision.
- Use allow-listed enum values only.
- Use field-level validation details in 400/422 errors.
- Never accept client-supplied `tenantId`, `createdByMembershipId`, permission list, payment status or computed price as authoritative values.

### 7.2 Booking validation

- `durationMinutes` must be a multiple of 15.
- Start time must align to the 15-minute grid.
- Initial defaults: minimum 60 minutes, maximum 180 minutes, base slot 15 minutes, hold 10 minutes, buffer 0 minutes, timezone `Asia/Colombo`.
- Per-resource min/max and advance window are authoritative.
- Start must be in the future and within the configured advance window.
- End must be after start.
- The full requested interval and buffer must be available.
- `localStart` must be valid for the venue timezone; reject nonexistent/ambiguous local times rather than guessing.
- Price is calculated server-side as hourly rate × duration in hours for the MVP hourly model.
- Price snapshot is immutable after booking confirmation.
- Booking header total must equal the sum of booking item totals.
- MVP creates exactly one booking item per booking.
- A maintenance block cannot silently override an existing confirmed booking.

### 7.3 Guest checkout validation

- Name required, max 160 characters.
- Mobile required, valid E.164, max 16 characters.
- Email optional, valid email if present.
- Hold token required and high entropy.
- Hold must belong to the hostname-resolved tenant and remain active/unexpired.
- Payment preference must be enabled in the business payment settings.
- Guest confirmation response must not expose unrelated customer records.

### 7.4 Payment validation

- Receipt amount must be greater than zero.
- Receipt amount must not exceed the outstanding amount.
- Receipt currency must equal booking currency.
- Payment method must be one of the supported manual methods.
- Payment recording requires `payment.record`.
- Refund amount must be greater than zero and must not exceed the net received amount.
- Refund recording requires `payment.refund`.
- Payment receipts and refunds are immutable financial history; corrections use controlled void/reversal behavior, not destructive deletion.
- Venue payment records must never be confused with SPORTIFY subscription payments.

### 7.5 Resource, schedule and pricing validation

- Resource must belong to the current tenant, business, branch and enabled sport.
- `slotIntervalMinutes` is fixed at 15 in MVP.
- Minimum/maximum durations must be positive, ordered and divisible by 15.
- Operating hours use ISO weekdays 1–7.
- Closed schedule entries must have null open/close minutes.
- Open schedule entries require `0 <= openMinute < closeMinute <= 1440`.
- Only one operating-hours entry per weekday and scope.
- A holiday date is unique per branch.
- Availability block end must be after start.
- Creating a block overlapping confirmed bookings must return a conflict and require staff to resolve bookings first.
- Active pricing rules for the same resource must not overlap in effective period.

### 7.6 Website and media validation

- Subdomain slug lowercase; letters, digits and hyphens; no leading/trailing hyphen.
- Reject reserved platform names and duplicate slugs.
- Only one MVP responsive theme is selectable.
- Publish requires business profile, at least one active sport, branch, bookable resource, schedule and active price rule.
- Validate image content by file signature, not filename alone.
- Allow only configured image MIME types; reject executable/script formats.
- Store files in OCI Object Storage; database stores object key and metadata.
- Enforce configurable upload size/dimensions; values belong in deployment configuration.
- Public website returns only published public data; never return bank account data beyond the configured customer-facing transfer instructions.

---

## 8. Error code catalogue

| HTTP | Error code | Meaning / handling |
|---:|---|---|
| 400 | `BAD_REQUEST` | Malformed request or invalid query syntax |
| 400 | `VALIDATION_ERROR` | Field validation failed |
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired session |
| 401 | `INVALID_CREDENTIALS` | Login failed; do not disclose which field was wrong |
| 401 | `EMAIL_NOT_VERIFIED` | Verification required |
| 401 | `TOKEN_INVALID` | One-time token/hold token invalid |
| 401 | `TOKEN_EXPIRED` | One-time token expired |
| 403 | `FORBIDDEN` | Permission missing |
| 403 | `CSRF_VALIDATION_FAILED` | CSRF token invalid/missing |
| 403 | `TENANT_SUSPENDED` | Tenant suspended from relevant operation |
| 404 | `NOT_FOUND` | Record missing or outside tenant scope |
| 404 | `TENANT_HOST_NOT_FOUND` | Host is not a known published tenant website |
| 409 | `EMAIL_ALREADY_REGISTERED` | Email already belongs to an account |
| 409 | `SUBDOMAIN_TAKEN` | Subdomain already used/reserved |
| 409 | `SLOT_UNAVAILABLE` | At least one required slot unavailable |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Same key submitted with different request body |
| 409 | `HOLD_EXPIRED` | Hold expired before confirmation |
| 409 | `HOLD_ALREADY_CONVERTED` | Hold already converted to a booking |
| 409 | `BOOKING_STATE_CONFLICT` | Requested transition not valid from current status |
| 409 | `MAINTENANCE_CONFLICT` | Block overlaps confirmed booking |
| 409 | `RESOURCE_HAS_FUTURE_BOOKINGS` | Resource cannot be deactivated until bookings handled |
| 409 | `DUPLICATE_RESOURCE_CODE` | Resource code already used in branch |
| 409 | `DUPLICATE_HOLIDAY` | Holiday already exists for branch/date |
| 422 | `BUSINESS_RULE_VIOLATION` | General domain rule failed |
| 422 | `INVALID_BOOKING_DURATION` | Duration not allowed or not a 15-minute multiple |
| 422 | `INVALID_TIME_GRID` | Start/end do not align to slot grid |
| 422 | `OUTSIDE_OPERATING_HOURS` | Requested time outside schedule |
| 422 | `RESOURCE_NOT_BOOKABLE` | Resource inactive/closed/non-bookable |
| 422 | `PAYMENT_METHOD_DISABLED` | Selected method not enabled by business |
| 422 | `PAYMENT_EXCEEDS_OUTSTANDING` | Receipt greater than outstanding amount |
| 422 | `REFUND_EXCEEDS_NET_RECEIVED` | Refund exceeds net received amount |
| 422 | `PUBLISH_REQUIREMENTS_NOT_MET` | Website setup incomplete |
| 422 | `SUBSCRIPTION_LIMIT_REACHED` | Plan entitlement limit reached |
| 422 | `SUBSCRIPTION_INACTIVE` | Operation blocked by subscription policy |
| 422 | `PARTIAL_PAYMENT_NOT_IN_MVP` | Partial receipt workflow not enabled in MVP |
| 429 | `RATE_LIMITED` | Retry after the supplied `Retry-After` |
| 500 | `INTERNAL_ERROR` | Unexpected error; use requestId for support |
| 503 | `DEPENDENCY_UNAVAILABLE` | Database/storage/required dependency temporarily unavailable |

Clients must branch on stable error codes, not message text. Messages may be localized.

---

## 9. Rate limits and abuse controls

The architecture requires rate limiting but does not specify fixed numeric quotas. Therefore, exact thresholds must be set in deployment configuration and load-tested before pilot.

At minimum apply separate configurable limits to:
- Registration, login and password reset by IP and normalized account identifier.
- Email verification resend by account/IP.
- Public availability by IP/tenant.
- Public hold creation by IP/tenant/resource and checkout session.
- Public booking confirmation by IP/tenant and hold.
- Media uploads by authenticated tenant and user.
- Admin actions by platform identity.

Return HTTP 429 and `Retry-After`. Use progressive delay/account lockout for repeated authentication failures. Add anti-automation protection to guest booking only where abuse is observed or risk requires it.

---

## 10. Audit, notifications and background jobs

- Booking creation, cancellation, completion/no-show, payment receipt/refund, staff changes, permission changes, tenant status and subscription changes must write audit events.
- Audit records include actor, tenant, action, entity, timestamp and request ID. Do not include passwords, tokens or sensitive payment details.
- Write an outbox event in the same transaction as important domain changes; process notifications asynchronously.
- Use the database-backed `JOB_QUEUE` and `OUTBOX_EVENTS` tables for MVP background processing.
- Hold expiry must be checked synchronously during hold/booking operations; background cleanup is supplementary.
- Email delivery is required for verification and staff invitation; provider selection and credentials are deployment decisions.
- SMS and WhatsApp automation are excluded from MVP.

---

## 11. Database mapping and schema alignment

| API domain | Primary schema tables |
|---|---|
| Auth/session | `USERS`, `AUTH_SESSIONS`, `EMAIL_VERIFICATION_TOKENS`, `PASSWORD_RESET_TOKENS` |
| Tenant/membership/RBAC | `TENANTS`, `TENANT_USERS`, `ROLES`, `PERMISSIONS`, `ROLE_PERMISSIONS`, `USER_ROLES`, `PLATFORM_ADMINS` |
| Staff/invitations | `TENANT_INVITATIONS`, `STAFF_ASSIGNMENTS` |
| Business/onboarding | `BUSINESSES`, `BUSINESS_PROFILES`, `ONBOARDING_PROGRESS` |
| Sports/facilities | `SPORTS`, `BUSINESS_SPORTS`, `LOCATIONS`, `RESOURCES`, `RESOURCE_FEATURES` |
| Schedule/availability | `OPERATING_HOURS`, `HOLIDAYS`, `AVAILABILITY_BLOCKS`, `PRICING_RULES` |
| Guest/customer | `CUSTOMERS`, `BOOKING_HOLDS`, `BOOKING_HOLD_ITEMS` |
| Booking | `BOOKINGS`, `BOOKING_ITEMS`, `RESOURCE_SLOT_RESERVATIONS`, `BOOKING_CANCELLATIONS` |
| Venue payment | `BUSINESS_PAYMENT_SETTINGS`, `PAYMENTS`, `REFUNDS` |
| Platform subscription | `SUBSCRIPTION_PLANS`, `SUBSCRIPTION_ENTITLEMENTS`, `SUBSCRIPTIONS`, `SUBSCRIPTION_INVOICES`, `SUBSCRIPTION_PAYMENTS` |
| Website/media | `WEBSITE_THEMES`, `WEBSITE_SETTINGS`, `WEBSITE_MEDIA` |
| Operations | `IDEMPOTENCY_KEYS`, `OUTBOX_EVENTS`, `JOB_QUEUE`, `NOTIFICATIONS`, `NOTIFICATION_LOGS`, `AUDIT_LOGS` |

### 11.1 Explicit schema/API gaps to resolve

1. **Public identifiers:** add opaque public IDs to API-addressable entities that currently expose only numeric identity keys (see §2.6).
2. **Missing permission codes:** add the extra codes in §3.3 through a migration and seed their role mappings.
3. **Hold duration configuration:** the MVP specifies a 10-minute hold and the schema has `expires_at_utc`, but no explicit tenant/resource hold-duration column. For v1 use a centrally configured default of 10 minutes; do not expose tenant-level customization until a schema/configuration decision is approved.
4. **Payment status scope:** schema allows partial-payment states, while MVP business/UX status language is `UNPAID`, `PAID`, `REFUNDED`. Keep partial payment dormant unless product scope changes.
5. **Booking item cardinality:** schema supports multiple items, but MVP application creates exactly one booking item per booking.
6. **Business settings aggregation:** `/business/settings` is an API façade over tenant defaults and related configuration; do not invent a new `BUSINESS_SETTINGS` table without a migration/ADR.
7. **Operating-hours replacement:** the database uniqueness key includes nullable `RESOURCE_ID`; verify Oracle's null uniqueness behavior and implement a safe branch-level upsert strategy.
8. **Registration transaction:** confirm the exact transaction boundary for pending email verification, tenant provisioning, owner membership, roles, business/profile and trial subscription before implementation.

### 11.2 Schema/API invariants

- Every tenant-owned relationship must include `TENANT_ID` in the query and composite FK.
- Runtime DB user must not be Oracle `ADMIN`.
- Session pool must set UTC timezone on every new connection.
- Price snapshots on hold/booking items are immutable after confirmation.
- Payment records and subscription payments are separate flows.
- No cascading deletion of booking, payment, customer, tenant or audit history.
- Database migrations are versioned; never edit an applied migration.

---

## 12. OpenAPI implementation and code-generation rules

`openapi.yaml` is the machine-readable contract in this package.

Implementation requirements:
- Keep `openapi.yaml` version-controlled under `/docs/api/`.
- Validate it in CI (lint + OpenAPI 3.1 validation).
- Generate or maintain typed frontend API contracts from this source.
- NestJS DTO validation must match the schemas and constraints.
- Do not let generated types replace runtime validation.
- Add examples for all P0 operations.
- Treat changes to request/response fields, permission requirements, status enums or idempotency as contract changes requiring review.
- Do not change an endpoint's semantics without updating the OpenAPI document and tests.
- Keep internal Oracle numeric IDs out of public payloads.

Recommended repository placement:

```text
docs/
  api/
    SPORTIFY_API_Specification_v1.0.md
    openapi.yaml
    error-codes.md
    api-change-log.md
```

---

## 13. API acceptance and test matrix

### 13.1 Authentication and authorization

- Register owner with valid details.
- Duplicate email is rejected without leaking account details.
- Unverified user cannot access dashboard.
- Verification and reset tokens are one-time and expire.
- Logout revokes session.
- Deactivated user/membership cannot reuse session.
- Receptionist cannot manage branches, resources, staff, website or subscription.
- Manager cannot manage platform tenants/plans.
- Super Admin endpoints reject tenant users.
- CSRF protection rejects missing/invalid token on cookie-auth writes.

### 13.2 Tenant and branch isolation

- Tenant A cannot read/update Tenant B business, branches, resources, customers, bookings, payments, reports or website.
- Changing a path/query public ID does not bypass tenant scope.
- User with two tenant memberships sees only selected active tenant.
- Branch Manager/Receptionist cannot access unassigned branch data.
- Public host resolves only the corresponding published tenant.
- Unknown/reserved/unpublished host is rejected safely.

### 13.3 Booking integrity

- 60-minute booking creates four 15-minute slot rows.
- 45-minute or non-grid duration rejected when below configured minimum or invalid.
- Two simultaneous same-resource overlapping holds: exactly one succeeds.
- Any slot conflict rolls back every inserted slot.
- Expired holds are ignored/released even if worker is delayed.
- Hold conversion has no release/re-reserve gap.
- Same idempotency key/body returns original booking.
- Same idempotency key/different body returns `IDEMPOTENCY_KEY_REUSED`.
- Manual and online booking use the same reservation service.
- Cancellation releases correct slots and preserves history.
- Maintenance block cannot silently override confirmed booking.
- Historical booking price does not change after pricing update.

### 13.4 Payments and reporting

- Confirmed unpaid booking remains confirmed.
- Receipt does not change booking status.
- Receipt cannot exceed outstanding amount.
- Duplicate receipt request is idempotent.
- Refund cannot exceed net received amount.
- Subscription payments never appear as venue receipts.
- Booking value and payments collected are calculated separately.
- Voided receipts are excluded from collected totals.

### 13.5 Website, subscriptions and operations

- Website publish fails when required setup is incomplete.
- Duplicate/reserved subdomain is rejected.
- Public website exposes only public content.
- Invalid file type or size is rejected.
- Subscription limits block additional branches/resources/staff where configured.
- Suspended tenant cannot accept new public bookings.
- Tenant history is preserved after suspension/expiry.
- Audit logs are immutable through business APIs.
- Health/readiness endpoints do not disclose secrets.

---

## 14. Release gates

### Gate A – API contract approved

- [ ] Product owner approves endpoint catalogue and MVP boundaries.
- [ ] Permission mapping approved.
- [ ] Public ID/schema amendment approved.
- [ ] Hold-duration and payment-status decisions recorded.
- [ ] OpenAPI validates as 3.1.0.
- [ ] Frontend and backend agree on all P0 payloads.

### Gate B – Backend integration ready

- [ ] Oracle bootstrap validated on target ADB release.
- [ ] Runtime grants are least privilege.
- [ ] UTC pool session callback works.
- [ ] Tenant context middleware and branch guards tested.
- [ ] Idempotency store and replay behavior tested.
- [ ] Booking concurrency integration tests pass.

### Gate C – Pilot API release

- [ ] All P0 endpoint tests pass.
- [ ] No critical/high tenant-isolation or booking-integrity defect.
- [ ] API logs and request IDs available.
- [ ] Rate limits configured.
- [ ] OpenAPI documentation published for internal use.
- [ ] Staging smoke tests and rollback procedure pass.
- [ ] UAT sign-off completed.

---

## 15. Final implementation recommendation

Build the API in dependency order:

1. Auth, tenant context and RBAC.
2. Business onboarding and tenant configuration.
3. Sports, branches, resources, schedules and pricing.
4. Availability and booking reservation service.
5. Public website and guest checkout.
6. Booking operations and manual bookings.
7. Payment receipts/refunds.
8. Staff/customer operations and reports.
9. Subscription and Super Admin controls.
10. Security, performance, recovery and pilot hardening.

**Do not start with dashboard screens or create a separate booking path for staff.** The reservation service, tenant guard and database constraints are the foundation of the product.

**End of document.**


### 5.13 Partial update semantics

All `PATCH` operations are partial updates. Omitted fields remain unchanged; explicit `null` is accepted only for nullable fields documented by the corresponding schema. At least one mutable property must be supplied. `PUT /locations/{locationId}/operating-hours` is a full replacement of the weekly schedule for the specified branch/resource scope.

### 5.14 Public ID migration checklist

Before exposing the OpenAPI paths, add and seed stable opaque IDs for at least:
- `LOCATIONS`, `RESOURCES`, `TENANT_USERS`, `TENANT_INVITATIONS`
- `HOLIDAYS`, `AVAILABILITY_BLOCKS`, `PRICING_RULES`
- `PAYMENTS`, `REFUNDS`
- `WEBSITE_SETTINGS`, `WEBSITE_MEDIA`

Use `SPORTS.SPORT_CODE`, `SUBSCRIPTION_PLANS.PLAN_CODE` and `SUBSCRIPTION_INVOICES.INVOICE_NUMBER` as stable public keys where appropriate. `TENANTS.PUBLIC_ID`, `USERS.PUBLIC_ID`, `CUSTOMERS.PUBLIC_ID`, `BOOKING_HOLDS.PUBLIC_ID` and `BOOKINGS.PUBLIC_ID` already exist in the schema baseline.
