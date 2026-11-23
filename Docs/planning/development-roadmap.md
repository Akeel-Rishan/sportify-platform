# MVP development roadmap

Current authorized scope: **Step 09 subscription/website/audit/outbox/job/idempotency database migrations only.** D-24 approves the three structural policy groups while excluding commercial, numeric operating, collection/retention and secret replay configuration. Oracle compatibility/test-owner, complete isolated and application apply/repeat/catalog/history-preservation gates now passed; awaiting user verification. No product website/checkout, background processing, Step 10 or deployment is authorized. [Current evidence and exact staged commands](../database/step09-verification.md). Older milestones below are historical planning references, superseded only within the explicit scoped database prompts.

Historical Step 08 scope: the explicit Step 08 prompt authorizes database-only facilities/booking/venue-finance/reservation migrations and actual Oracle tests, superseding historical Step 08 UI scope. D-21 policies and D-22 verification are recorded. Application 000012-000017 applied/repeated/verified; the dedicated Step 08 suite passed integrity/A-E races/cleanup/runtime denials while preserving Step 07 history. See [current Step 08 status](../database/step08-verification.md). No application service, product screen or Step 09 is authorized.

Previous verified baseline: **Step 07 executed and verified on Oracle; awaiting user verification**. D-18 design choices are approved; the original 11 migrations applied cleanly, repeated as a no-op and passed catalog/reference checks plus isolated integrity/locking/recovery/privilege verification. Final local checks passed 188 tests and all builds. [Dated evidence](../database/step07-verification.md) and [progress](progress.md) are the current record. The explicit Step 08 database-only prompt below now defines its new draft scope; application authentication/booking services remain unstarted and are not implied by database structures.

The explicit Step 03 prompt assigns environment validation, lint/format/testing and CI to this step and excludes Oracle and business functionality. The original Oracle milestone is retained below as a deferred prerequisite, without an invented new step number. Later product step numbers remain historical planning references; the next scoped prompt must reconcile their Oracle dependency before implementation. The explicit Step 04 prompt now authorizes API transport conventions, logging and application health only; authentication and Oracle remain deferred. The explicit Step 05 prompt assigns database design only; earlier UI/auth/Oracle implementation milestones remain deferred. The scoped Step 06 prompt now authorizes account preparation/connectivity only, as recorded below; business implementation remains deferred.

All steps follow the [definition of done](../quality/definition-of-done.md), [product quality bar](../design/product-quality-bar.md) and [decision register](decision-register.md). Audit, authorization, accessibility, localization and relevant tests accompany each feature; they are not a final-phase backlog.

## Step 01 — Repository audit and implementation baseline

- **Objective:** Establish evidence-based scope and a reviewable implementation plan without application changes.
- **Dependencies:** Readable source documents and workspace access.
- **Outputs:** Documentation index, scope, traceability, decisions, roadmap, completion/design standards, progress and project instructions.
- **Verification gate:** Required sources read, SQL found, original files unchanged, links/IDs/scope checked, unresolved proposals explicit, no unrelated edits or secret material added. Evidence in [progress](progress.md).
- **Status:** Awaiting user review.

## Step 02 — Workspace and toolchain foundation

- **Objective:** Establish the minimal pnpm TypeScript monorepo after Step 01 review.
- **Dependencies:** Reviewed Step 01 baseline and explicit Step 02 instruction. No Oracle credentials needed to begin foundation work.
- **Outputs:** Pinned Node/pnpm/framework/tool versions and ARM64 support evidence; minimal web/API/worker/shared-package structure, install/dev/build/typecheck commands and setup documentation. Existing Git repository preserved; no commit/push requested.
- **Verification gate:** Frozen install, clean-output build/typecheck, development/production startup and shutdown, package export and hygiene checks. Browser inspection must pass or be explicitly reported unavailable/blocked. ARM64 execution remains untested until performed. Empty runtime skeletons must not be described as business functionality. Actual evidence is in progress.
- **Requirements:** REQ-047, REQ-052, REQ-057, REQ-064.
- **Status:** Awaiting user verification; executable foundation checks passed, browser verification outstanding.

## Step 03 — Environment and quality foundation

- **Objective:** Establish safe configuration boundaries and reproducible local/PR quality checks.
- **Dependencies:** Existing Step 02 scaffold; unchanged runtime/framework versions.
- **Outputs:** Per-app schemas/loaders, server-only web boundary, ESLint/Prettier, focused Node tests and coverage, read-only GitHub Actions workflow and development guides.
- **Verification gate:** Frozen install, full `pnpm check`, scoped coverage thresholds, real development/production startup and safe failure, controlled lint failure, hygiene and CI configuration review. Remote CI and browser checks must be distinguished from local execution.
- **Status:** Awaiting user verification; see [progress](progress.md). Step 04 has not started.

## Deferred Oracle schema and connection foundation (previous Step 03 baseline)

- **Objective:** Establish a tested Oracle persistence boundary before business features.
- **Dependencies:** Step 02; approved relevant schema decisions (Q-01, Q-03, Q-08, Q-11, Q-14, Q-15, Q-17, Q-18); actual target ATP staging access and version/connectivity details supplied securely when needed.
- **Outputs:** Reviewed migration/bootstrap strategy, required amendments, schema owner/runtime separation, restricted grants, TLS connection/pool/session initialization, transaction/repository conventions and migration registry. Keep dormant-feature scope explicit.
- **Verification gate:** Execute on actual Oracle; run supplied verification queries, inspect invalid objects/constraint/index status and seeds; prove UTC binding, rollback and cross-tenant FK rejection. Validate aggregate API 8 / worker 2 initial pool budget, not just per-process settings. Record failures and corrections accurately.
- **Requirements:** REQ-001–002, REQ-048–051, REQ-063.
- **Status:** Not started.

## Step 04 — API conventions and operational endpoints

- **Objective:** Establish versioned transport contracts, safe errors, correlation, request logs, runtime DTO validation and application-only liveness/readiness.
- **Dependencies:** Step 03 tooling and existing Nest/Express adapter. No external service or identity decision is required for these transport foundations.
- **Outputs:** Shared contracts, one production/test configuration function, centralized pipeline, health module, focused unit/HTTP suites and API guides.
- **Verification gate:** Root quality/build checks, coverage, real HTTP parser/error/correlation/status/logging/readiness cases and built API health/readiness/shutdown. Record actual results in progress.
- **Status:** Awaiting user verification; local checks passed (see progress). Step 05 remains pending.

## Deferred authentication, tenancy and authorization (previous Step 04 baseline)

- **Objective:** Establish trustworthy identity, membership, branch scope and platform separation.
- **Dependencies:** Steps 02–03; Q-08, Q-15, Q-17–18 and applicable Q-23 decisions.
- **Outputs:** Registration/verification/reset/session flows, tenant selection, centralized permissions and branch guards, admin audience restrictions, foundational email delivery and audit events. Create only the authentication UI needed for these workflows; its final styling can use Step 05 foundations.
- **Verification gate:** Actual Oracle auth/membership integration, two-tenant negative tests, session rotation/revocation, cookie/CSRF/origin tests, invitation identity safety, secret-safe logs and keyboard/localization-ready forms. Active tenant cannot be forged.
- **Requirements:** REQ-002–008, REQ-044, REQ-046, REQ-051–052, REQ-064.
- **Status:** Not started.

## Step 05 - MVP database design

- **Objective:** Establish the reviewable MVP dictionary, relationships, constraints and migration design without database execution.
- **Dependencies:** Supplied MVP/architecture/schema/API sources and explicit Step 05 confirmed architectural direction.
- **Outputs:** [Database package](../database/README.md), full catalog disposition, proposed exact dictionary/constraints, transactions/finance/operations/index/migration designs, three ERDs and read-only structural checker; decision/traceability evidence updated.
- **Verification gate:** Complete catalog/column coverage, compatible tenant-safe FK keys, slot XOR/resource consistency, consistent statuses/lock protocol, index/dependency/ERD/link checks and unchanged source/app artifacts. Oracle tests remain future work.
- **Status:** Awaiting user review. No provisioning, DDL, database connection or Step 06 implementation.

## Deferred UI foundation (previous Step 05 baseline)

- **Objective:** Establish reusable visual and interaction foundations for four application experiences.
- **Dependencies:** Step 04 identity/navigation boundaries and approved [quality bar](../design/product-quality-bar.md).
- **Outputs:** Validated typography with Sinhala/Tamil coverage, color/spacing/type tokens, app shells, accessible forms/dialogs/tables/status indicators, translation structure and responsive navigation. Identify any prototype fixtures explicitly.
- **Verification gate:** Phone/tablet/desktop keyboard and layout checks, measured text/control contrast, visible focus, accessible names, text expansion and three-script rendering. Components cannot imply live business data before integration.
- **Requirements:** REQ-053–056.
- **Status:** Not started.

## Step 06 - Account preparation and secure Oracle connectivity (scoped prompt)

- **Scope:** Operator SQLcl scripts/runbook, separate owner/API/worker identities, server-only Thin connection package, configuration, pools/UTC/transaction helpers, Oracle-required readiness and explicit verification tools.
- **Status:** Scoped Step 06 runtime connectivity/privilege/readiness and built process checks passed, with deployment/remote-outage/PUBLIC-baseline limits recorded separately. Step 07 subsequently installed its approved schema through the operator-only runner; this does not implement business workflows. See current evidence/progress.
- **Gate:** Local quality/build checks plus actual target confirmation, provisioning postconditions, TLS/session/privilege and real readiness verification. Scoped evidence passed; driver mocks alone are not Oracle evidence. The later explicit Step 07 prompt and D-18 approval authorized that work.

## Deferred onboarding and business configuration (historical Step 06)

- **Objective:** Enable owners to save/resume business, sports, branch, facility, schedule, pricing and branding setup.
- **Dependencies:** Steps 03–05; Q-05–06, Q-16, Q-18, Q-21–23 decisions needed for these contracts.
- **Outputs:** Scoped configuration APIs/forms, saved onboarding progress, catalog/branch/resource management, schedules/holidays, hourly pricing, media validation/storage, required setup checklist and entitlement interfaces. Publication goes live in Step 09.
- **Verification gate:** Owner end-to-end setup on Oracle, restart/resume, permission/branch denial, relationship/validation checks, schedule/rate boundaries, media access tests and responsive/localized form states. Audit configuration mutations. No active custom-domain/theme-builder UI.
- **Requirements:** REQ-009–017, REQ-035, REQ-038, REQ-041, REQ-044.
- **Status:** Not started.

## Step 07 - Authentication, tenancy and facility database migrations (scoped prompt)

- **Scope:** One migration ledger, operator-only runner, approved auth/tenancy/permissions/configuration SQL, reference seeds, minimal runtime grants and actual Oracle verification.
- **Current:** D-18-approved original 000001-000011 applied and verified on the designated Oracle target; 26 tables, 259 columns, 206 named constraints, 30 explicit indexes, eight sports and 20 permission codes. Repeat/checksum/seed, 33 integrity cases, concurrent DDL locking, retained failure/recovery and runtime-denial checks passed. Original application history has 11 APPLIED/no repairs or pending versions. Awaiting user verification; no application authentication/booking behavior implemented.
- **Gate:** Required structural decisions, scoped SQL/integrity tests and actual target execution passed; see dated evidence for the corrected catalog verifier and retained test-only recovery history. Stop after Step 07. The next explicit prompt must establish Step 08 scope and prerequisites; no application login/guards/tenant-routing or booking workflow is inferred from the schema.

## Deferred availability, pricing, holds and reservation engine (historical Step 07)

- **Objective:** Prove booking integrity before connecting full booking screens.
- **Dependencies:** Steps 03–06; resolve Q-04–Q-10, Q-16, Q-19 and relevant configuration values. Admission/entitlement rules must be enforceable before SaaS admin UI exists.
- **Outputs:** Shared availability/pricing/reservation services, hold ownership/expiry/conversion, slot allocation, immutable snapshots, idempotency, maintenance serialization, transactional audit/outbox and worker foundations.
- **Verification gate:** Actual Oracle parallel overlap tests (one winner), all-or-nothing slot rollback, hold expiry/conversion races, manual/public shared service, maintenance/suspension races, midnight/timezone/buffer/price edits, authorized idempotent replay, worker crash/reclaim and no notification-dependent booking rollback. Document lock protocol and measured contention.
- **Requirements:** REQ-012–022, REQ-024, REQ-028, REQ-042, REQ-044–045.
- **Status:** Not started.

## Step 08 — Booking operations

- **Objective:** Enable authorized staff to perform genuine daily booking workflows.
- **Dependencies:** Steps 05–07; Q-20 manual booking/payment separation.
- **Outputs:** Calendar/agenda/list and filters, booking detail, manual bookings, customer lookup minimum needed for booking, cancellation with reason, completion and no-show. Receipt actions integrate in Step 10.
- **Verification gate:** Live manual booking updates shared availability; role/branch scope and filtered totals correct; cancellation releases only owned slots; terminal-state retries safe; retained history audited. Responsive calendar and keyboard action flows work with loading/empty/error/retry/denied states.
- **Requirements:** REQ-024–027, REQ-033, REQ-044, REQ-054–055.
- **Status:** Not started.

## Step 09 — Tenant websites and guest checkout

- **Objective:** Publish independent branded sites and complete real guest reservations.
- **Dependencies:** Steps 06–08; Q-08–09 and Q-21 public payload/publication decisions.
- **Outputs:** One responsive template, tenant-host resolution/cache rules, preview/publish checks, facility availability, review/hold countdown, guest details and confirmation. Display configured payment preferences without a gateway.
- **Verification gate:** Two published tenants stay isolated; unknown/unpublished hosts rejected; server-backed checkout, expiry/conflict/retry/refresh and no-reference-only PII access verified. Correct media/pricing/hours/policy/contact information, all three languages and phone accessibility tested.
- **Requirements:** REQ-019–023, REQ-035–037, REQ-053–055.
- **Status:** Not started.

## Step 10 — Venue payments, staff, customers and reports

- **Objective:** Complete daily operations with reconciled finances and staff access.
- **Dependencies:** Steps 04, 08–09; Q-02, Q-17–22 decisions. Deliver small slices: receipts/refunds → staff/customer administration → reports.
- **Outputs:** Manual receipts/refunds and history, staff invite/branch/revocation flows, customer directory/permitted history and reports with explicit booking-value/collection definitions.
- **Verification gate:** Real Oracle financial race/cap/idempotency tests, independent booking/payment states, invitation/last-owner safeguards, customer privacy and known-data report totals. Keyboard/localized financial forms, audit events and failure recovery verified per slice.
- **Requirements:** REQ-029–034, REQ-039, REQ-044, REQ-053–055.
- **Status:** Not started.

## Step 11 — SaaS administration

- **Objective:** Manage platform tenants, plans, trials and manual subscriptions through controlled admin flows.
- **Dependencies:** Steps 04, 07, 10; Q-10, Q-21–23 lifecycle/invoice/configuration decisions.
- **Outputs:** Tenant search/status controls, sports/plan management, trial/renewal/assignment, invoice/manual subscription receipt workflow, centralized entitlements, owner subscription view, platform statistics and audit browsing.
- **Verification gate:** Platform/tenant session separation, sensitive-action confirmations/audit, suspend/reactivate and grace/expiry matrix, transaction admission races, plan limits and downgrade cases, invoice-number resolution and ledger separation. Do not seed illustrative prices as approved plans.
- **Requirements:** REQ-004, REQ-010, REQ-040–044.
- **Status:** Not started.

## Step 12 — Deployment, operations and recovery

- **Objective:** Establish a repeatable ARM64 deployment and verified operational recovery.
- **Dependencies:** Steps 02–11; selected OCI tenancy/region/service capabilities verified at provisioning time; Q-08, Q-11, Q-13, Q-23 operational decisions.
- **Outputs:** Target-compatible images, Nginx/Cloudflare trust configuration, safe secrets, staging/pilot separation, CI/deployment gates, logs/health/alerts, worker operations, backup/export/restore and rollback runbooks.
- **Verification gate:** Build/run on target architecture, private internal app ports, trusted-host/cookie/TLS behavior, migration rollout, health/smoke and previous-image rollback; timed restore drill against agreed RPO/RTO; notification/job recovery and capacity monitoring. Commercial recovery gate remains closed until evidence meets Q-13.
- **Requirements:** REQ-045–046, REQ-048, REQ-057–061, REQ-064.
- **Status:** Not started.

## Step 13 — Pilot verification and release review

- **Objective:** Demonstrate a working multi-tenant MVP and obtain evidence-based pilot approval.
- **Dependencies:** Steps 02–12 verified; all release-critical Q-IDs resolved or explicitly documented as nonblocking with approved scope.
- **Outputs:** Requirement-to-test evidence, at least two complete tenant journeys, owner/staff/customer/admin UAT, three-language/responsive/accessibility results, realistic load report, recovery evidence and pilot operating plan targeting 10–15 businesses subject to capacity.
- **Verification gate:** No critical isolation, booking, financial or accessibility defect; documented manual/automated results and limitations; agreed rollback/support ownership. Proposed UX success targets must be measured with real participants, not claimed from screenshots. Commercial approval is a separate recovery/business gate.
- **Requirements:** REQ-001–064 as applicable, especially REQ-060–062.
- **Status:** Not started.

Marketplace, custom domains, gateways, recurrence and other excluded features have no implementation step here. Architecture extension points are permitted only when needed for the current MVP, not as hidden future-feature work.

## Step 08 - Booking, slot and venue finance database migrations (scoped prompt)

- Scope: reuse seven existing facility/schedule structures; ten new customer/hold/booking/slot/cancellation/payment/refund table drafts, indexes, minimal grants and real Oracle tests only.
- Current: 000012-000017 applied/repeated/catalog-verified after complete isolated Oracle suite success. Original 11 entries unchanged; Step 08 awaiting user verification. No Step 09.
- Gate: local quality/build checks and actual clean/repeat/catalog, exact relationship/slot integrity and A-E Oracle races. Mocks/static tests do not satisfy this gate. No application services/UI or Step 09.
