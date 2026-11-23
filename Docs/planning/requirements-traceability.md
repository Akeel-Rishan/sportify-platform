# Requirements traceability

Status: **awaiting user review**. Source codes link to the [source register](../README.md#source-register). Section numbers refer to the document's numbered headings, not PDF page numbers. SQL sources identify tables; OAS sources identify schemas or routes.

IDs `REQ-001` onward are permanent: do not reuse or renumber them. Business behavior remains **Not started**. REQ-047 has scaffold evidence from Step 02; broader deployment, security and API requirements are not complete. Intended verification is a future gate unless evidence is linked. Statuses may be In progress, Blocked (with reason), Verified (with evidence), or Deferred (only with explicit scope decision). Q-IDs resolve in the [decision register](decision-register.md). Owners are logical modules.

| ID | Source and section | Requirement summary | Owning module | Intended verification | Implementation status |
|---|---|---|---|---|---|
| REQ-001 | MVP §3.1; DB §§1, 3 | One business per tenant; multiple branches within entitlements | Tenants / Businesses | Oracle rejects a second business for the tenant; branch limit integration cases | Not started |
| REQ-002 | MVP §3.1; ARCH §§7.1, 8.1–8.2 | Shared database; trusted tenant resolution, filtered queries and composite tenant FKs | Tenants / Database | Two-tenant read/write denial and cross-tenant FK failure on Oracle | Not started |
| REQ-003 | MVP §§3.12, 5.3; API §3 | Owner, Manager, Receptionist permissions and branch scope enforced on backend | Authorization / Staff | Role/action matrix, unassigned branch rejection and counts filtered before pagination | Not started |
| REQ-004 | MVP §3.13; ARCH §8.3; API §3.5 | Platform administration has separate controlled access | Admin / Auth | Tenant sessions cannot access admin; least-privilege platform tests | Not started |
| REQ-005 | MVP §3.2; API §§4.1, 5.1 | Registration validates required business/owner fields and provisions recoverably | Auth / Onboarding | Invalid/duplicate requests and transaction failure rollback; Q-15 | Not started |
| REQ-006 | MVP §3.2; ARCH §8.4 | Email verification before dashboard access; validate mobile; OTP deferred | Auth | Unverified login restrictions, one-use expiring token and valid/invalid mobile cases | Not started |
| REQ-007 | ARCH §8.4; API §2.4 | Argon2id passwords, hashed session/reset tokens, rotation, expiry and revocation | Auth | Hash/expiry/replay/logout/deactivation tests; password policy Q-23 | Not started |
| REQ-008 | ARCH §8.5; API §§2.4, 7.1, 9 | Secure cookies, CSRF, input validation, rate limiting and safe errors | Security / API | CSRF and origin tests, invalid DTOs, rate-limit response, sanitized failure output; Q-08 | Not started |
| REQ-009 | MVP §3.2; UX ONB-01–08 | Onboarding saves/resumes and validates essentials before publish | Onboarding | Interrupt/reload wizard, resume correct tenant, missing setup checklist | Not started |
| REQ-010 | MVP §3.3 | Eight named configurable sports; tenant chooses from global catalog | Sports | Seeds, admin changes and tenant selection verified without hardcoded sport logic; Q-22 | Not started |
| REQ-011 | MVP §3.4; API §7.5 | Manage tenant branches and resources, details/capacity/status and enabled sport | Locations / Resources | Scoped CRUD, invalid relationships and future-booking deactivation checks | Not started |
| REQ-012 | MVP §3.5; DB §§4.3, 6 | Branch hours, resource availability, holidays and closures | Availability | Weekly/holiday/override intersection and closed-day cases; Q-06, Q-21 | Not started |
| REQ-013 | MVP §§3.5, 6.2; SQL-001 resources and slot reservations | Fixed 15-minute grid; initial 60–180-minute duration and zero buffer defaults | Reservations | Local and UTC grid, duration bounds, complete slot set; Q-05, Q-06 | Not started |
| REQ-014 | MVP §3.5; API §7.2 | Enforce advance booking window and venue timezone | Availability | Boundary dates, past times and venue/browser timezone mismatch | Not started |
| REQ-015 | MVP §§6.1, 6.8 | Availability respects all restrictions; maintenance cannot override bookings | Availability | Overlap/closure/hold tests and simultaneous maintenance/booking Oracle test; Q-04 | Not started |
| REQ-016 | MVP §6.6; DB §6.6 | Hourly pricing; server-calculated exact money and non-overlapping active rules | Pricing | Decimal totals and concurrent price-rule changes; Q-07 | Not started |
| REQ-017 | MVP §6.6; ARCH §10.8 | Persist immutable rate and booking total snapshots | Pricing / Bookings | Change future rates and prove confirmed history remains unchanged | Not started |
| REQ-018 | MVP §6.3; DB §6.1; SQL-001 resource_slot_reservations | Database uniqueness on tenant/resource/slot; no partial reservation | Reservations / Database | Parallel requests on actual Oracle: exactly one winner; entire loser rolls back | Not started |
| REQ-019 | MVP §6.4; DB §§6.3–6.5 | 10-minute hold default, server expiry and synchronous stale-hold cleanup | Holds / Worker | Freeze/control clock boundaries and delay worker; relevant slots become reusable; Q-16 | Not started |
| REQ-020 | MVP §6.5; DB §6.4 | Atomic hold conversion confirms booking independent of payment | Bookings | Expiry/conversion race, no reservation gap, confirmed/unpaid result | Not started |
| REQ-021 | MVP §3.7; UX §7.1 | Guest name/mobile required, email optional, no account required | Guest checkout | Mobile end-to-end success and invalid inputs without authentication | Not started |
| REQ-022 | ARCH §8.6; API §§4.5, 6.3 | Secure guest hold ownership; reference alone grants no later customer access | Holds / Guest API | Wrong/missing token and cross-tenant hold rejected; safe confirmation replay; Q-09 | Not started |
| REQ-023 | MVP §3.7; UX WF-03–05 | Show venue/resource/local times/duration/price, timer, policy and confirmation reference | Tenant UI | Review before confirm, accessible expiry/conflict recovery and full confirmation content | Not started |
| REQ-024 | MVP §3.9; API §6.4 | Walk-in, phone, WhatsApp and staff bookings use same reservation service | Bookings | Online/manual race on Oracle, source recording and public availability refresh | Not started |
| REQ-025 | MVP §3.8; UX BOOK-01–03 | Daily/weekly/resource calendar and list/search/date/branch/resource filters | Booking operations UI | Filtered counts, details, mobile agenda and keyboard flow | Not started |
| REQ-026 | MVP §6.7; API §6.5 | Staff cancellation reason, permission, atomic release and retained history | Bookings / Audit | Unauthorized/stale cancellation, correct slot release, retained payments and reason | Not started |
| REQ-027 | MVP §§3.8, 6.9; API §6.6 | Completion/no-show transitions from confirmed; distinct hold and booking states | Bookings | Legal/illegal/repeated transitions and no accidental history loss | Not started |
| REQ-028 | MVP §6.11; API §2.9 | Idempotent holds, bookings and financial writes | Idempotency | Same/different payload, parallel requests, replay authorization and crash recovery; Q-19 | Not started |
| REQ-029 | MVP §§3.10, 6.10 | Separate booking and payment status; MVP unpaid/paid/refunded labels | Payments / UI | Status matrix and user explanation; partial-state contract resolved in Q-02 | Not started |
| REQ-030 | MVP §3.10; API §§5.10, 7.4 | Manual cash/bank/card-at-venue receipts with amount, date and reference | Payments | Receipt/outstanding/currency validation, duplicate request and history tests | Not started |
| REQ-031 | MVP §6.7; API §§5.11, 7.4 | Manual refunds separately recorded with limits and audit; no automatic transfer | Payments / Audit | Concurrent refund cap, authorization and independent booking status; Q-02 | Not started |
| REQ-032 | MVP §§3.10–3.11; DB §7 | Venue payments and subscription ledger distinct; booking value vs collections | Payments / Reports | Reconciliation fixtures including cancellations, refunds and voids; Q-20 | Not started |
| REQ-033 | MVP §3.9; PRD §12; API §4.5 | Tenant customer search/create/update and permitted history | Customers | Tenant/branch privacy, lookup and duplicate-contact policy; Q-21 | Not started |
| REQ-034 | MVP §3.12; API §4.7 | Staff invite, role/branch assignment, activation and deactivation | Staff / Auth | Invitation expiry/replay, branch persistence, owner safeguards and session revocation; Q-17 | Not started |
| REQ-035 | MVP §3.6; UX §§2, 8 | One responsive template with branding/content/media configuration | Websites / UI | Two venues render correct distinct content; no inactive themes/builder controls | Not started |
| REQ-036 | MVP §3.6; ARCH §§11.3–11.7 | Verified SPORTIFY subdomain routing, reserved host rejection and tenant-safe caching | Routing / Websites | Spoofed forwarding host, unknown/unpublished host and cross-tenant cache tests; Q-08 | Not started |
| REQ-037 | MVP §3.6; API §7.6 | Publish only with required setup; edits update published website | Websites / Onboarding | Publish blockers, preview, saved changes and cache invalidation; draft semantics Q-21 | Not started |
| REQ-038 | ARCH §12; API §7.6 | Validate/re-encode allowed images, store in OCI Object Storage, separate private objects | Media | Signature/size/ownership rejection, public read isolation and private access denial | Not started |
| REQ-039 | MVP §3.11 | Basic booking/revenue/cancellation/sport reports within authorized scope | Reports | Known-data totals, date/timezone boundaries and filtered branch aggregates | Not started |
| REQ-040 | MVP §§3.14, 7 workflow 6 | Trials, plans, dates, limits, manual renewal and subscription receipt recording | Subscriptions / Admin | Plan assignment/extension, receipt and entitlement lifecycle; Q-10, Q-21 | Not started |
| REQ-041 | MVP §§3.4, 3.14, 9.7 | Central plan entitlements enforce branch/resource/staff limits | Entitlements | Concurrent create at limit, denied access and downgrade behavior; Q-10 | Not started |
| REQ-042 | MVP §9.7 | Suspended tenants cannot accept new public bookings; history retained | Tenants / Subscriptions | Suspend/confirm race, new booking denial and preserved historical records; Q-10 | Not started |
| REQ-043 | MVP §3.13; UX ADMIN-01–07 | Admin tenant search/status, sports/plans/statistics and audit controls | Admin | Permission and audited sensitive-action flows using synthetic tenants | Not started |
| REQ-044 | MVP §3.1; ARCH §8.7; API §10 | Audit sensitive authentication, booking, payment, staff and admin actions | Audit | Actor/tenant/request/event recorded with change transaction; no ordinary edit API or secrets | Not started |
| REQ-045 | ARCH §13; API §10 | Durable transactional outbox and database jobs, bounded retries and deduplication | Worker / Notifications | Crash before/after provider send, leases/reclaim, duplicate delivery and delayed cleanup; Q-11 | Not started |
| REQ-046 | ARCH §13.2; API §10 | Async verification/invitation email; notification failure cannot cancel booking | Notifications / Auth | Provider failure and retry, persisted booking and secret-safe delivery logs | Not started |
| REQ-047 | ARCH §§4–5; user's technical direction | pnpm TypeScript monorepo, Next.js, NestJS modular monolith and separate worker | Foundation | [Step 02 evidence](progress.md): pinned compatibility metadata, frozen installation, clean build/typecheck and independent processes | Verified for scaffold; awaiting user verification |
| REQ-048 | ARCH §§7.2–7.4 | Restricted Oracle runtime account, parameterized SQL, TLS and pooled connections | Database | Actual ATP TLS/grant/bind checks; API max 8 + worker max 2, aggregate session budget | Not started |
| REQ-049 | ARCH §7.5; SCHEMA §2; DB §2 | Consistent TIMESTAMP(6) UTC persistence and venue-local presentation; Step 05 direction confirmed | Database / Time | Every new pooled session UTC, round-trip/grid tests on Oracle; Q-01, Q-06 | Not started |
| REQ-050 | DB §§5, 7, 11; SCHEMA §9 | Tenant-aware FKs, decimal money, retained history and versioned migrations | Database | Oracle bootstrap, constraints/indexes, cross-tenant negative tests and migration checksums | Not started |
| REQ-051 | API §§2.6, 3.3, 11.1 | Opaque public IDs and permission mappings align schema/API | Database / API | Migration/backfill constraints and every endpoint guard tested; Q-14, Q-18 | Not started |
| REQ-052 | ARCH §9; API §§2, 7, 12 | Versioned REST, safe envelopes, runtime DTO validation and maintained OpenAPI | API / Contracts | OpenAPI 3.1 lint/validation, runtime contract examples and frontend types; Q-18 | Not started |
| REQ-053 | MVP §2.1; UX §§4, 12 | English, Sinhala and Tamil core interfaces, LKR/Colombo defaults | UI / Localization | All core flows in three languages, script glyphs, number/time display and text expansion | Not started |
| REQ-054 | PRD §24; UX §§10–12 | Phone/tablet/desktop usability, semantic labels, focus, contrast and touch targets | UI / Accessibility | 360/768/1280 CSS px checks, keyboard/calendar/dialog checks and measured contrast | Not started |
| REQ-055 | UX §10; PRD §24.3 | Loading, empty, error, success, retry and permission-denied states | UI / API | Controlled failure/latency scenarios with data preservation and idempotent retry | Not started |
| REQ-056 | PRD §24.1; UX §§4, 17 | Coherent sports SaaS design; usable calendars/forms/financial information | Design / UI | Review against product quality bar with realistic labeled fixtures; no invented live metrics | Not started |
| REQ-057 | ARCH §§14–15 | ARM64-compatible Docker/Nginx deployment, isolated environments and CI | Delivery | Target architecture builds, internal-only services, route/smoke/rollback checks | Not started |
| REQ-058 | ARCH §§6.6–6.7, 11.5, 14.5 | Restricted origin/network access and secret-safe configuration | Infrastructure / Security | Forwarded-header, TLS/origin ACL and secret-scan evidence; no browser credentials | Not started |
| REQ-059 | ARCH §16 | Structured logs, request IDs, dependency health and capacity monitoring | Operations | Safe failure logs/health probes; measured pools, worker backlog and alert tests | Not started |
| REQ-060 | ARCH §16.4; PRD §26.1 | Measure pilot read/availability/booking/dashboard p95 targets | Performance | Document dataset, workload, concurrency, duration and measured percentiles | Not started |
| REQ-061 | MVP §11; ARCH §17; DB §14 | Verified backup/recovery before commercial production | Recovery | Agreed RPO/RTO and successful timed restore drill; Q-13 | Not started |
| REQ-062 | MVP §§9, 11–12 | Real Oracle integrity/isolation tests, full live workflows and controlled pilot | Quality / Pilot | At least two tenants, concurrency, staff/customer/admin UAT, then monitored pilot | Not started |
| REQ-063 | MVP §4; UX §15; DB §1 | Deferred catalog tables do not expand MVP | Architecture / Product | Route/navigation/schema-use review against exclusion list; Q-12 | Not started |
| REQ-064 | PRD §§22.4, 27; ARCH §§8.7, 16.3 | Protect customer data, redact secrets and define retention/access handling | Security / Operations | Negative access tests, redacted logs/exports and documented retention; Q-23 | Not started |

Source-level counts, YAML parsing and documentation checks do not verify any of these runtime requirements. Evidence is recorded in [progress](progress.md); step allocation is in the [roadmap](development-roadmap.md).

## Step 05 database design coverage

Design evidence only; all Oracle enforcement, concurrency, grants and business workflow results remain unexecuted. D-13 fixes the explicit timestamp direction; other Q-IDs are review proposals, not approved implementations. The existing runtime status column is not promoted by documentation checks. Step 04 transport-only evidence remains in progress and does not complete the broader security/OpenAPI/monitoring requirements.

| Requirements | Design evidence | Remaining verification |
| --- | --- | --- |
| REQ-001-007, REQ-034, REQ-048-051 | [Dictionary](../database/data-dictionary.md), [relationships](../database/relationships-and-constraints.md), public UUIDs, invitation branches, session scope and exact-string IDs | Actual target DDL, tenant/global-identity negatives, grants and driver/session tests |
| REQ-009-017, REQ-035-038 | [Disposition](../database/mvp-table-scope.md), [index plan](../database/index-plan.md), relational schedules/pricing/host routing and snapshots | Accept overnight/buffer/API amendments; real configuration/publishing/media workflows |
| REQ-018-028 | [Booking invariants](../database/booking-invariants.md), [operational replay](../database/operational-data.md), exact slot PK/XOR/resource-safe FKs | Parallel Oracle hold/confirmation/expiry/cancellation/maintenance/idempotency tests |
| REQ-029-033, REQ-039-043 | [Financial rules](../database/financial-rules.md), separate ledgers, term/feature snapshots and status formulas | Product partial/refund/zero-value/lifecycle approval; actual reconciliation and entitlement races |
| REQ-044-046, REQ-059, REQ-064 | [Operational data](../database/operational-data.md), scoped audit/notifications, outbox/jobs/leases | Security review of reconstruction/redaction/retention and real worker/provider crash handling |
| REQ-048-050, REQ-061-063 | [Migration strategy](../database/migration-strategy.md), [verification plan](../database/verification-plan.md) | Actual ATP provisioning, execution/recovery/backup tests; no Oracle test marked passed |

The [three new MVP ERDs](../database/README.md) and repeatable structural checker support review only. They do not replace the required future tests or supersede the preserved source uploads without acceptance.

## Historical Step 07 initial implementation overlay

REQ-048/REQ-050 are **In progress, Oracle verification blocked**: operator-only manifest/runner, history/reference SQL and unit evidence exist, but the required authentication/tenancy/facility subset still needs the explicitly identified Step 05 structural decisions. REQ-010 is **In progress, SQL only** for eight-sport deployment seed artifacts, not executed/runtime-configurable behavior. REQ-001/002/003/004/005/006/007/009/011-017 remain unverified and application behavior is not started; no authentication, tenant authorization or booking capability is marked complete. [Exact inventory](../database/implemented-schema.md) and [progress](progress.md) distinguish designed, SQL-written, Oracle-executed and real-tested states. Existing requirement IDs/source mappings above remain stable.

## Historical Step 07 draft artifact evidence

REQ-048/REQ-050 now have a prepared review-gated 26-table SQL draft, one-ledger runner, static design/artifact verification and explicit disposable Oracle integrity/recovery/denial suite. REQ-010 tenant scope is represented by composite keys/FKs and test cases, not verified application authorization. Security/schedule/permission approvals, owner/test credentials, narrow lock capability and actual Oracle execution remain pending. No authentication, onboarding, availability/pricing service or booking requirement is marked complete from DDL/fixtures. See [inventory](../database/implemented-schema.md) and [current progress](progress.md).

## D-18 scoped acceptance

The user explicitly approves the Step 07 structures/grid and 20 tenant permission codes; manifest ready clears design approval only. REQ-048/050 remain in progress pending Oracle migration/integrity/recovery/privilege evidence. No authentication, tenant authorization, booking or commercial behavior is marked complete. Existing requirement IDs and unrelated Q-ID gates remain unchanged.

## Step 07 Oracle verification evidence, 23 November 2026

The scoped database portion of REQ-048/REQ-050 now has real application clean apply/repeat/catalog and isolated integrity/lock/recovery/runtime-denial evidence. REQ-010 has actual eight-sport/20-permission seed verification and tenant-safe structural tests; runtime configuration/authorization behavior remains future work. These broad requirements retain in-progress status for later tables/workflows/deployment concerns; no authentication, tenant authorization, onboarding, pricing/availability or booking requirement is completed from DDL alone. [Dated results](../database/step07-verification.md) and [progress](progress.md) supersede the historical pending statements above without changing requirement IDs.
