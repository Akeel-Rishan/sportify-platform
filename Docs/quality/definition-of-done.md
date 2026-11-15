# Definition of done

Status: **proposed acceptance baseline awaiting user review**. Sources: MVP §§9–11; ARCH §§8, 15–17, 19–21; DB §13; API §§13–14; UX §§10–13, 16, indexed in the [source register](../README.md#source-register). These are gates for future changes, not statements that tests have passed.

## Evidence and scope

A change is complete only when its relevant requirements in [traceability](../planning/requirements-traceability.md) are met and evidence identifies the code revision, environment, command or manual procedure, result and remaining limitations. Record skipped checks and why. Mock data, mocked APIs, unit tests and static screenshots may prove limited behavior; they do not prove a live workflow, Oracle transaction or production readiness.

Keep each requested step small. Resolve blocking [decisions](../planning/decision-register.md) before dependent implementation. Include authorization, audit, accessibility, localization and tests in the affected feature. Do not defer them to a generic hardening phase. Do not add out-of-MVP features to satisfy a broad catalog.

## Backend and API changes

- Validate DTOs at runtime, including unknown fields, null/omitted values, numeric bounds and cross-field rules. Keep API/OAS/types/examples aligned.
- Derive authenticated tenant/actor/branch context server-side. Every tenant repository requires scope; guard reads, writes, lists, counts, exports and replay paths. Cross-tenant IDs must not disclose existence.
- Keep controllers thin, use parameterized SQL, explicit transaction ownership and centralized domain logic. Online/manual booking must call the shared reservation service.
- Test success, invalid input, denied access, stale state, duplicate request, dependency failure and relevant concurrency paths. Verify state transitions and rollback, not just HTTP codes.
- Write required audit/outbox events with the business transaction. Never turn notification failure into booking cancellation. Explain external side effects and retry semantics honestly.
- Return stable safe errors/request IDs; no raw SQL, stack traces, token values or internal credentials in responses/logs.

## Database changes

- Use versioned reviewed migrations and checksums; do not edit applied migrations. Record target Oracle version, account privileges and recovery approach.
- Run on **actual Oracle/ATP compatible with the deployment target**. Validate objects, enabled/validated constraints, indexes, grants, seeds and session initialization. A DDL text review is not compilation evidence.
- Prove tenant-aware FK failures, rollback behavior, money precision and UTC binding on Oracle. Test affected queries and plans under representative data.
- **SQLite or another database is not acceptable evidence for Oracle locking, constraints or booking concurrency.** Mocks can test orchestration only.
- For reservations, use genuinely simultaneous separate Oracle connections/transactions. Assert one winner for overlapping slots, full loser rollback and no orphan slots; cover hold expiry/conversion, online/manual races, cancellation, maintenance, suspension and idempotent retries. Check persisted state after transactions complete.
- Exercise financial races where receipts/refunds could exceed allowed amounts. Preserve historical snapshots and records. Review schema changes against Q-01–Q-23 where relevant.

## Frontend and live workflows

- UI uses the [product quality bar](../design/product-quality-bar.md). Connect each shipped action to its real API or clearly label an explicitly requested prototype as a mock.
- Verify loading, empty, error, success, retry and permission-denied states. Distinguish loading from zero results; retain safe entered values after recoverable failures.
- Test full workflows in a browser with the real backend and Oracle when claiming live completion. Record fixture identity/environment without exposing personal data or secrets.
- Verify cookie/CSRF behavior through the intended hosts, not just an API client. Backend authorization remains necessary even when menus are hidden.
- Prevent accidental duplicate submission; reuse idempotency context for safe retries. Show partial workflow outcomes correctly, such as booking saved but receipt recording failed.
- Separate booking and payment indicators, show final price/time/policy before confirmation, and handle expired holds without promising availability.

## Security and sensitive data

- Verify tenant and branch isolation with at least two tenants and multiple roles. Admin authority is separate; a tenant session never grants admin access.
- Hash passwords/tokens as designed, validate rotation/revocation/expiry, test CSRF/origin/rate limits and guest token ownership. Never expose raw identities as sequential public IDs where opaque IDs are required.
- Validate file content, size, ownership and storage visibility; reject unsafe uploads. Keep private exports separate from public media.
- No secrets, wallet files, session/hold tokens or real customer fixtures in commits, docs, screenshots, logs or test output. Use safe variable names/placeholders, redaction and synthetic data. A pattern scan supplements manual review; it is not proof of absence.
- Collect only necessary customer data. Define retention/export/access policy and record operational privacy decisions; do not invent legal compliance claims.

## Accessibility and localization

- Test keyboard-only completion of affected flows, logical focus order, visible focus, dialog focus management and accessible names/errors. Test calendars and time slots beyond automated lint checks.
- Measure relevant contrast and ensure status is not color-only. Test primary touch targets and viewport layout against the quality bar.
- Keep interface strings translatable; check English, Sinhala and Tamil core flows with actual glyph-rendering fonts and expanded text. Confirm local date/time, LKR/tenant currency and +94-compatible mobile presentation.
- Test announcements for async failures/success and hold-expiry warnings without a screen-reader announcement every second. Automated accessibility checks are useful but require manual keyboard and screen-reader checks for critical flows.

## Deployment and operations

- Pin/validate tooling and runtime compatibility in Step 02; build/run deployment images on the target ARM64 environment before claiming support.
- Isolate local/staging/pilot configuration. No production development data or unapproved copies of customer data. Only the reverse proxy exposes web ports.
- Verify host/header trust, HTTPS, cookie audience, storage access, health/readiness redaction, pool budgets and worker retries. Confirm actual cloud limits during provisioning.
- Run migration, deployment, smoke and rollback procedures. Retain a known working application image and a compatible schema forward/recovery plan.
- Define and measure RPO/RTO and restore into an isolated Oracle target. Commercial release requires the approved verified recovery solution; logical exports alone are not point-in-time recovery evidence.
- Load tests state dataset, concurrency, workload and duration. Report observed p95 and failures, not only configured targets. Monitor sessions, queue lag, storage, errors and recovery alerts.

## Documentation-only changes

For Step 01, completion means source inventory/readability, scoped accurate documentation, stable IDs, working links, explicit unresolved recommendations and preserved originals. Check the diff or, without Git, compare the original file hashes and enumerate every addition. Do not install a testing framework or claim application tests passed. Status remains **awaiting user review**, and work stops at the requested step.
