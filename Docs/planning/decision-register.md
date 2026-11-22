# Decision register

Status: **awaiting user review**. Source codes resolve in the [source register](../README.md#source-register). Requirement IDs resolve in [traceability](requirements-traceability.md); step numbers resolve in the [roadmap](development-roadmap.md).

Established D-IDs reflect the user's confirmed Step 01 baseline. Q-IDs remain **open for their stated policy/implementation or verification gates**; proposals are not approvals. Explicitly confirmed subparts (such as D-13 timestamp direction) are identified separately. This register does not silently override a source. To close a Q-ID, record the user's decision, date, affected contracts/migrations/requirements and verification evidence. No Q-ID has been approved in this step.

## Established direction

| ID | Established decision | Authority and implications |
|---|---|---|
| D-01 | MVP scope takes precedence over the broader roadmap | User Step 01; MVP §§3–4. Future schema entities do not become delivery requirements |
| D-02 | One business per tenant, shared Oracle schema, tenant filtering and composite tenant FKs | User baseline; MVP §3.1; DB §§1, 5. Branches are entitlement-limited |
| D-03 | pnpm/TypeScript, Next.js, NestJS modular monolith, separate Node worker | User technical direction; ARCH §§4–5. Version/ARM64 selection belongs to Step 02 |
| D-04 | Oracle ATP, node-oracledb and parameterized SQL; restricted runtime grants | User technical direction; ARCH §7. Initial pool caps API 8 / worker 2 must be validated against aggregate deployment capacity |
| D-05 | One reservation engine, 15-minute units, database-enforced uniqueness and atomic transactions | User baseline; MVP §6; DB §6. Frontend availability is never the concurrency guard |
| D-06 | Guest booking auto-confirms after valid hold conversion; payment is separate | User baseline; MVP §§3.7, 3.10, 6.5. No approval queue or payment gateway |
| D-07 | Three tenant roles and separately controlled platform administration | User baseline; MVP §§3.12–3.13. Permission/branch checks remain mandatory |
| D-08 | Server sessions with hashed tokens, secure cookies and Argon2id | User technical direction; ARCH §8.4. Cookie topology remains Q-08 |
| D-09 | One responsive branded template, verified tenant subdomains, three core UI languages | User baseline; MVP §§2.1, 3.6. No marketplace/custom domains |
| D-10 | Database jobs/outbox, OCI Object Storage, Docker ARM64, Nginx and Cloudflare | User technical direction; ARCH §§11–15. No initial Redis or Kafka |
| D-11 | Preserve financial/booking history and require verified recovery before commercial operations | User baseline; MVP §§6.7, 9.7, 11; ARCH §17. Concrete commercial recovery route remains Q-13 |
| D-12 | Step 01 changes documentation only and stops for user review | User Step 01. No scaffolding, dependency installation/version selection, infrastructure edits, commits or pushes |
| D-13 | Step 05 database design uses NUMBER identity/internal keys, UUID public IDs, TIMESTAMP(6) UTC instants, UTC sessions, IANA zones with Colombo default, NUMBER(12,2)/currency, tenant-aware composite FKs and restricted runtime accounts | Explicit confirmed architectural direction in the user's Step 05 prompt. This fixes the timestamp representation direction of Q-01; it does not approve new policy proposals or establish Oracle execution evidence |

## Open reconciliation and design questions

### Q-01 — Timestamp representation

Step 05 clarification: the user's confirmed direction explicitly selects TIMESTAMP(6) stored as UTC and UTC session initialization. That representation is established, not still an open recommendation. Exact target/driver binding, precision, session lifecycle and real Oracle verification remain open; no runtime result is claimed.

- **Evidence:** ARCH §7.5 recommends `TIMESTAMP WITH TIME ZONE`; SCHEMA §2, DB §2 and SQL-001 use `TIMESTAMP(6)` with a UTC-only convention and `LOCALTIMESTAMP` defaults. DB explains the slot primary-key constraint as the reason.
- **Impact:** Driver binding, pool initialization and date conversion can otherwise shift persisted reservations. REQ-013, REQ-049, REQ-050.
- **Proposed resolution:** Adopt the detailed schema's UTC `TIMESTAMP(6)` representation, amend the architecture record, initialize every newly created pooled session to UTC and explicitly control bind/read conversion. Keep the venue IANA timezone for presentation. Verify the target Oracle release and driver behavior rather than treating the document's database claim as executed evidence.
- **Gate:** Step 03 before time-sensitive schema/driver work; Step 07 round-trip/concurrency tests.

### Q-02 — Partial payments and refunds

- **Evidence:** MVP §6.10 and API §5.11 allow only `UNPAID`, `PAID`, `REFUNDED` in active workflows. SQL-001 bookings permits `PARTIALLY_PAID` and `PARTIALLY_REFUNDED`. API §7.4 caps receipt/refund amounts but does not require a full settlement/refund; its error catalog mentions partial-payment exclusion.
- **Impact:** A valid smaller receipt/refund has no agreed MVP display state; totals and labels could disagree. REQ-029–032.
- **Proposed resolution:** Keep schema superset states dormant and allow only full outstanding settlement and full remaining refundable amount in MVP. Obtain explicit product confirmation; otherwise approve an intentional scope/contract expansion for partial states. Define zero-value bookings and receipt corrections too. Never silently map a partial amount to `PAID` or `REFUNDED`.
- **Gate:** Before Step 10 payment implementation and its DTO/UI contract.

### Q-03 — Complete SQL availability and Oracle execution evidence

- **Evidence:** SCHEMA §§9, 11 references the bootstrap and verification scripts. Both are present in `Docs/SPORTIFY_Database_Design_Package_v1.0/`. Full bootstrap includes 61 table definitions, 361 named constraints, 90 explicit indexes and seeds. Three ERDs and the detailed specification are present.
- **Impact:** There is no missing complete DDL input; there is also no evidence it compiles on the target ATP release. Counts are static, not runtime validation. REQ-048–050.
- **Proposed resolution:** Preserve the supplied bootstrap. At Step 03 inspect constraints/indexes, execute against a dedicated empty staging schema, stop on errors and run SQL-002 plus integration checks. Record corrections through controlled migration/bootstrap review; never invent a replacement schema or edit an applied migration. Review redundant unique-key/index declarations rather than assuming every declaration succeeds.
- **Gate:** Step 03 needs a target Oracle environment and restricted connection access. This does not block Step 02 foundation planning.

### Q-04 — Maintenance concurrency and locking order

Step 05 refinement: the latest concrete proposal is the short tenant-row admission mutex and fixed ordering in [booking invariants](../database/booking-invariants.md). It supersedes the earlier unaccepted preference below for finer-grained admission gates. The coarse design is explicit, unmeasured and requires acceptance/load testing before implementation.

- **Evidence:** DB §6.3 locks a resource before stale-hold cleanup; §6.4 locks a hold for conversion. API §§6.2–6.5 mirrors this. MVP §6.8 forbids maintenance overriding bookings. No complete common lock order covers resource/hold/booking/tenant/branch-block and schedule mutations.
- **Impact:** Resource→hold versus hold→resource paths can deadlock; a branch-wide block or schedule change can race new holds. REQ-015, REQ-018–020, REQ-026, REQ-042.
- **Proposed resolution:** Specify one lock protocol before coding: proposed hierarchy tenant admission gate → branch gate → affected resource IDs ascending → hold/booking records → financial records. Design the admission gates to serialize suspension and branch-wide restrictions without unnecessarily serializing every normal tenant booking. Revalidate optimistic discovery after locks; all booking/block/schedule/resource-state paths participate. Establish bounded deadlock/timeout retry behavior. Validate lock granularity under pilot load before adoption.
- **Gate:** Step 07 design approval and actual Oracle races: hold vs conversion/expiry, booking vs maintenance, cancellation vs new booking and suspension vs conversion.

### Q-05 — Buffer reservation semantics

- **Evidence:** MVP §3.5 makes buffer configurable, starting at zero. SQL-001 resources has before/after minutes, but slot reservations have no core/buffer distinction and no buffer snapshot. API requires the full interval and buffer available.
- **Impact:** Adjacent bookings can consume one another's buffers; later configuration changes can alter historical interpretation. Non-grid buffers do not fit the reservation key model directly. REQ-013, REQ-015, REQ-018.
- **Proposed resolution:** Define occupancy as `[start − before, end + after)`; require buffers to be nonnegative multiples of 15 and reserve every occupied slot under the same hold/item. Price only play duration. Snapshot applied buffers and clarify whether occupancy must fit operating hours, and whether adjacent buffers can overlap (recommend no overlap initially). Default zero remains valid, but do not silently remove the configurable-buffer requirement. Any new snapshot columns require a reviewed migration.
- **Gate:** Step 06 configuration contract, before Step 07 slot algorithm.

### Q-06 — Overnight schedules and local grid alignment

- **Evidence:** MVP §3.5 requires schedules; SQL-001 permits one interval per weekday with `open < close <= 1440`. It cannot directly express a 22:00–02:00 interval in one row. API §2.7 selects local wall time; SQL-001 checks UTC minute alignment. International expansion is product intent, not permission to guess ambiguous times.
- **Impact:** Overnight booking, holiday boundaries and timezone offsets can invalidate an otherwise selectable interval. REQ-012–014, REQ-049.
- **Proposed resolution:** Store overnight openings as two day segments and validate the entire requested interval across dates. Define resource overrides as restrictions within branch opening hours, not an implicit reopening. Split break periods into blocks. Apply holidays in venue-local dates. Validate local grid and resulting UTC slot grid; support `Asia/Colombo` first, and explicitly reject unsupported/ambiguous/nonexistent conversions. If splitting requires multiple intervals on a day, revise the schedule model rather than silently losing hours.
- **Gate:** Step 06 schedule contract and Step 07 boundary tests. Overnight support expectations require user decision before exposing it.

### Q-07 — Price at hold versus price at confirmation

- **Evidence:** MVP §6.6 describes saving price at confirmation. DB §6 and SQL-001 hold items already snapshot rate/total. API §6.3 converts the hold but does not explicitly settle a rate edit during those ten minutes.
- **Impact:** Repricing at confirmation can contradict the amount the customer reviewed. REQ-016–017, REQ-023.
- **Proposed resolution:** Honor the committed hold's rate/total until expiry; copy it into the booking transaction. Reprice a newly acquired hold after expiry, with explicit review. Define the effective-rule selection instant, rounding, currency and what happens if the service spans a rate boundary (recommend one start-time rate for the whole MVP reservation).
- **Gate:** Step 07 pricing/hold acceptance tests; Step 09 display contract.

### Q-08 — API host, host-only cookies and admin session separation

- **Evidence:** ARCH §§4.2, 14.4 routes apps at `app`/`admin` and same-host `/api/v1`; API §2.1 proposes `api.sportify.lk`, while §2.4 says host-only cookies where practical. SQL-001 auth_sessions stores user/token/expiry but no active tenant or application audience.
- **Impact:** An API-host cookie does not automatically implement separate dashboard/admin sessions; central public API requests also lose the tenant website Host unless trusted forwarding is specified. REQ-007–008, REQ-036, REQ-052, REQ-058.
- **Proposed resolution:** Serve same-origin `/api/v1` through each approved host, use separate host-only dashboard/admin session cookies (no parent-domain cookie), store audience and validated active membership server-side, and reject tenant-site sessions at admin. Proxy must overwrite forwarding headers and reject unrecognized hosts. Document login CSRF, origin checks, logout/rotation and multi-membership selection. Align OpenAPI servers with the approved topology; a central API-host alternative needs an equally explicit trust model.
- **Gate:** Step 03 session schema amendment; Step 04 auth and Step 12 proxy/browser verification.

### Q-09 — Guest ownership and confirmation access

- **Evidence:** ARCH §8.6 and API §§2.4, 4.5, 5.6–5.7 require high-entropy hold tokens and no reference-only customer retrieval. Hold tokens are stored hashed; API §2.9 also requires response replay. UX WF-05 has a confirmation screen, not a later lookup policy.
- **Impact:** Replaying a hold response can persist raw token material in idempotency storage; refresh/retry can expose PII or duplicate operations without an ownership policy. REQ-020–023, REQ-028.
- **Proposed resolution:** Treat hold token as a short-lived secret, validate tenant/owner on confirm/release, keep it out of URLs/logs and avoid durable browser storage. Decide a secret-safe idempotent hold response design (e.g. protected short-lived response storage or separate checkout ownership); hashing alone cannot reproduce the raw token. Permit confirmation replay only to the proven original checkout. Do not add reference-only lookup or customer account flows. Any durable confirmation access token requires explicit scope and expiry decisions.
- **Gate:** Step 07 ownership/idempotency design, Step 09 refresh and recovery tests.

### Q-10 — Suspension, expiry, grace and entitlements

- **Evidence:** MVP §9.7 blocks new public bookings and preserves history. SQL-001 has tenant and subscription lifecycles including grace/past due, but no complete action matrix. API §11.1 leaves several policy decisions open.
- **Impact:** Existing holds, manual bookings, owner login, receipts, plan downgrades and reactivation can be treated inconsistently. REQ-040–042.
- **Proposed resolution:** Approve a matrix per tenant/subscription state. Recommend suspension blocks new holds and conversion (including pre-existing holds), preserves authorized historical read/receipt/refund access, and clearly explains renewal steps. Decide manual booking restrictions separately. Define grace duration as configuration, plan downgrade over-limit behavior, precedence of explicit suspension over paid renewal and trial start. Enforce at transaction admission under Q-04, not only in UI.
- **Gate:** Step 07 public admission contract; full Step 11 lifecycle implementation.

### Q-11 — Outbox versus job queue

- **Evidence:** ARCH §13 says outbox or job queue; DB §4.7 and SQL-001 include both. Outbox lacks the queue's explicit lock owner/time fields. No exactly-once external delivery guarantee is specified.
- **Impact:** Dual scheduling or crashing after delivery can duplicate notifications; stale processing records can stall work. REQ-045–046, REQ-059.
- **Proposed resolution:** Domain transactions write outbox events. A dispatcher durably converts events to uniquely keyed jobs and marks dispatch in one Oracle transaction. Workers claim with locking/leases, bounded backoff and stale-lease recovery; persist attempts and terminal failures. Delivery is at least once: use provider idempotency where available and document duplicate risk otherwise. Scheduled cleanup/subscription checks are queue jobs; notification logs record delivery attempts. Choose lease schema and retention before implementation.
- **Gate:** Step 03 schema review, Step 07 outbox foundations and Step 12 crash/recovery tests.

### Q-12 — Broad schema catalog versus MVP

- **Evidence:** DB §§1, 4 labels future areas; MVP §4 and UX §15 exclude them. SQL-001 creates recurring, gateway/webhook, domains/verification, marketplace/review and support tables.
- **Impact:** Full bootstrap coverage can be mistaken for a feature backlog. REQ-063.
- **Proposed resolution:** Retain source bootstrap as supplied, explicitly label dormant objects and implement only required MVP routes/services/UI. Decide at Step 03 whether the staging bootstrap uses the broad catalog or reviewed staged migrations; no automatic activation of future tables. Neither option adds future-feature work to this roadmap.
- **Gate:** Step 03 migration plan and every later scope review.

### Q-13 — Recovery before commercial production

- **Evidence:** PRD §20.6 and ARCH §17 require paid production-grade recovery; MVP §11 also permits another verified solution meeting agreed requirements. DB §14 explicitly says the supplied DDL has not run on the live database. Cloud/free-tier descriptions are unverified provisioning assumptions.
- **Impact:** A successful pilot or logical export is not evidence of commercial disaster recovery. REQ-061–062.
- **Proposed resolution:** Prefer a suitable paid ATP configuration before business-critical commercial service. Agree RPO/RTO, backup frequency/retention, export protection and restore owners; demonstrate recovery into an isolated compatible target. Any alternative needs explicit approval and equivalent measured evidence. Check actual tenancy/region/shape/session/storage/backup capabilities during provisioning.
- **Gate:** Step 12 restore drill and Step 13 commercial gate; foundation work is not blocked.

### Q-14 — Public identifiers missing from DDL

- **Evidence:** API §§2.6, 5.14, 11.1 requires opaque API IDs; SQL-001 lacks them on many addressed tables. OAS additionally returns operatingHourId, auditLogId and subscriptionPaymentId as UUIDs beyond the minimum migration checklist.
- **Impact:** Direct DTO mapping would expose sequential keys or fabricate IDs. REQ-051.
- **Proposed resolution:** Inventory every API-exposed identifier; add stable public IDs and appropriate unique constraints/backfill for locations, resources, memberships/invitations, hours, holidays, blocks, pricing, receipts/refunds, website media/settings and other UUID-bearing API entities. Keep internal identity joins private. Stable sport/plan codes remain public keys. Review each platform/tenant uniqueness scope.
- **Gate:** Step 03 migration plan, then Step 04 and Step 06+ endpoint contracts.

### Q-15 — Registration and email verification sequence

- **Evidence:** UX flow 01 creates tenant/membership after verification; API §§4.1, 5.1 returns tenantPublicId during registration and provisions a baseline before dashboard access. DB §9.2 and API §11.1 leave transaction boundaries to reconcile.
- **Impact:** Interrupted verification can create orphaned identities, duplicate tenants or ambiguous trial start. REQ-005–006, REQ-009.
- **Proposed resolution:** Provision a recoverable pending registration/tenant baseline atomically, prevent normal dashboard access until verification, and activate onboarding after verification. Specify abandoned registration expiry, invitation reuse and subscription/trial start without deleting retained history. Update the UX sequence and API/DB transaction description together.
- **Gate:** Step 04 registration design, with needed schema changes reviewed at Step 03.

### Q-16 — Hold duration configuration

- **Evidence:** User/MVP §3.5 calls it an initial configurable default; UX ONB-06 mentions hold settings. API §11.1 specifies centrally configured ten minutes and says tenant-level customization is not yet modeled.
- **Impact:** Exposing an editable wizard setting promises behavior the schema/API cannot store. REQ-019.
- **Proposed resolution:** Use a centrally configurable ten-minute default initially and show an informational value in onboarding. Obtain confirmation that this satisfies the intended configurability; tenant/resource overrides require explicit configuration schema and API amendments.
- **Gate:** Step 06 wizard and Step 07 hold configuration.

### Q-17 — Staff invitation roles, branch persistence and owner safety

- **Evidence:** UX STAFF-01 lists inviting Owner/Manager/Receptionist; OAS StaffInviteRequest allows Manager/Receptionist only. SQL-001 tenant_invitations has a role but no pending branch-assignment storage. Existing-account invitation acceptance also lacks a clear authenticated identity-linking flow.
- **Impact:** An invite cannot reliably retain its authorized branches, and careless acceptance/role changes could escalate privileges or remove the last owner. REQ-003, REQ-034.
- **Proposed resolution:** Limit invitations to Manager/Receptionist for MVP; provision Owner at registration. Define owner-transfer separately before offering it. Persist requested branch assignments with tenant-aware relations, validate them again at acceptance and require the existing account to authenticate rather than reset its password through an invite. Protect the last owner and audit/revoke affected sessions.
- **Gate:** Step 03 schema decisions, Step 04 identity linking, Step 10 staff workflow.

### Q-18 — Contract consistency: permissions, PATCH and nullability

- **Evidence:** API §4.4 prose uses business.read for many facility reads; OAS uses location.read/resource.read, which SQL-001 does not seed. API §3.3 lists other missing permissions. PATCH /customers uses a schema requiring fullName/mobile despite API §5.13 partial-update semantics. API examples contain null for optional email/notes and branch-level resourceId/closed times, while OAS types generally disallow null. Some PATCH schemas permit empty bodies despite the prose rule.
- **Impact:** Generated types, guards and runtime DTOs would disagree, including receptionist access. REQ-003, REQ-051–052.
- **Proposed resolution:** Review an action-to-permission matrix, seed required tenant codes and mappings, and keep platform policy separate from tenant RBAC. Create true partial DTO schemas with at least one mutable field; explicitly choose null versus omission for clearing fields and closed schedules. Align examples and validators before generation. Do not assume YAML parsing equals OpenAPI 3.1 semantic validation.
- **Gate:** Step 03 permissions, Step 04 guards and Step 06 onward affected DTOs.

### Q-19 — Idempotency ownership, replay and retention

- **Evidence:** API §2.9 scopes keys tenant+operation and expects original status/body. ARCH §9.4 also requires authenticated/guest context. SQL-001 has fingerprint/body/expiry but no explicit actor, in-progress state or lease. Q-09 exposes hold-token persistence tension.
- **Impact:** Two actors reusing a key may see another response, and concurrent/crashed requests may repeat effects or remain stuck. REQ-028.
- **Proposed resolution:** Bind replay to validated actor or checkout ownership, include operation/resource scope and a canonical fingerprint, and authorize before replay. Define atomic claim/result storage, concurrent wait/conflict policy, failed transaction recovery and expiry. Choose TTL and protect any sensitive response material. Idempotency is not authorization.
- **Gate:** Step 07 protocol and Oracle failure tests; reuse for Step 10 financial writes.

### Q-20 — Manual booking/payment order and reporting definitions

- **Evidence:** UX flow 03 and WF-09 let staff set payment status before confirming; API §§5.8, 6.4 creates confirmed/unpaid booking and a separate receipt. Report endpoints need unambiguous date basis and treatment of refunds/cancellations.
- **Impact:** UI-selected `PAID` could have no receipt; booking success could be obscured by a later failed payment call. REQ-024, REQ-030–032, REQ-039.
- **Proposed resolution:** Create booking first, then offer a separate idempotent receipt action. If receipt fails, clearly show the existing confirmed/unpaid booking and retry receipt only. Define booking value by service date and collections by receipt date (proposed), disclose timezone, show refunds separately and exclude voided receipts from collections. Confirm cancellation and zero-value treatment with Q-02.
- **Gate:** Step 08 manual UX, Step 10 ledger/report contracts.

### Q-21 — Missing definitions and supporting artifacts

- **Evidence:** Required PDFs, complete SQL, API, ERDs and UX package are present. Separate authentication specification, provisioning guide, setup specification and Figma high-fidelity/design-system files referenced as next deliverables in ARCH §23/MVP §14 are not present. Runtime grant scripts, later migrations and test evidence are absent. API lacks dedicated public media/pricing/hours/contact expansion fields sufficient for every tenant-home wireframe; no complete customer history payload, subdomain allocation or subscription invoice creation workflow is defined. SQL holidays has no inactive status despite a deactivate route. Customer matching/branch visibility, draft vs live website edits and schedule null uniqueness also need explicit contracts. ERD 03 says monthly_price while SQL uses price_amount.
- **Impact:** Not every UX action can be built from the current contract, and labels can imply missing storage. REQ-012, REQ-023, REQ-033, REQ-035–040, REQ-048, REQ-052.
- **Proposed resolution:** Produce only the relevant missing specification in its owning roadmap step. Agree customer matching/branch lookup policy, tenant-safe history response, public website media/pricing/schedule/contact payload, subdomain allocation, invoice-number scope/issuance, holiday removal semantics and draft publication behavior. Reconcile ERD fields to validated DDL. Verify Oracle uniqueness with nullable resource_id on the target engine rather than assuming SQL behavior. Do not fabricate a Figma file or claim these deliverables exist.
- **Gate:** Auth details Step 04; configuration/public payload design Steps 06/09; customers/reports Step 10; invoices Step 11; infrastructure/recovery Step 12. None of these missing future deliverables prevents Step 02 foundation work.

### Q-22 — Extra seeds and financial method enums

- **Evidence:** MVP §3.3 specifies eight launch sports, while SQL-001 seeds a ninth `OTHER`. API/SQL receipt enums include `OTHER`, while the confirmed MVP lists cash/bank/card-at-venue. Schema plan prices are intentionally unseeded despite illustrative PRD prices.
- **Impact:** An extra enum/seed or sample price could accidentally become an approved product option.
- **Proposed resolution:** Keep eight named sports as the launch promise; confirm whether `OTHER` is available or dormant. Expose only the three approved receipt methods unless `OTHER` is explicitly accepted. Never treat sample rates/plan prices as commercial configuration.
- **Gate:** Step 03 seed plan, Step 06 catalog, Steps 10/11 payment/plan UI.

### Q-23 — Security and operational configuration not yet defined

- **Evidence:** API §§2.4, 2.9, 9 and 14 leaves password threshold, idempotency TTL and rate limits to decisions; ARCH §§12, 17 and PRD §22.4 require upload/security/recovery/retention policy without all numeric settings. Trial, session/token lifetime, email provider and concrete entitlement feature codes are not fully approved.
- **Impact:** Invented defaults can change access, data retention or user-facing promises. REQ-007–008, REQ-038, REQ-040, REQ-061, REQ-064.
- **Proposed resolution:** Maintain validated environment configuration with explicit owners and documented values as each step needs them. Confirm password/session/token policy at Step 04, uploads at Step 06, quotas and TTL at Step 07, plans/trials at Step 11 and recovery/retention at Step 12. Keep secrets outside source control. Verify current vendor capabilities only when selecting/provisioning; this audit does not validate external prices, limits or laws.
- **Gate:** The relevant implementation step; no fabricated values in Step 01.

## Review priority

For Step 02, review the established baseline and roadmap; there is no missing source input blocking foundation work. Before Step 03, prioritize Q-01, Q-03, Q-08, Q-11, Q-14, Q-15, Q-17 and Q-18 because they affect persistent structures or identity. Before the booking engine, resolve Q-04–Q-10, Q-16 and Q-19. Financial/product details must be settled before their owning steps. Future execution evidence remains mandatory even after a decision is approved.

## Step 05 design review

The explicit Step 05 prompt supersedes historical step numbers in earlier Q-ID gates: this step designs only; actual Oracle execution and later feature activation require separate authorization. The [database package](../database/README.md) is the concrete review proposal. None of the recommendations below is silently approved; D-13 records only explicit user architecture.

| Question | Source conflict/gap and impact | Proposed resolution / concrete design | Gate |
| --- | --- | --- | --- |
| Q-01 / Q-03 | ARCH 7.5 used zoned timestamps; schema PDF lists account creation before ATP; broad bootstrap has duplicate PLATFORM_ADMINS PK/UK and redundant HOLIDAYS index | D-13 fixes UTC plain timestamp direction; provision ATP before accounts. Target 19c-compatible design, verify actual release. Omit duplicate key/index in new MVP baseline; retain source uploads. [Migration strategy](../database/migration-strategy.md) | Representation explicit; target/compiler/execution verification still mandatory |
| Q-12 | Catalog creates 61 tables, including excluded features | Proposed MVP-only baseline includes 52 source tables, excludes nine; add exactly two justified association/snapshot tables. [Disposition](../database/mvp-table-scope.md) | Structural approval before executable baseline |
| Q-04 | Source create locks resource first while conversion locks hold first; no exclusion mechanism for maintenance | Shared tenant admission mutex, then fixed sorted subscription/location/resource/hold/booking/payment order. Maintenance rejects overlapping active holds/bookings, never becomes a third slot owner. [Transactions](../database/booking-invariants.md) | Lock protocol acceptance and real races before booking implementation; throughput unmeasured |
| Q-05 / Q-06 | No immutable buffer occupancy snapshots; open-hours CHECK can accept missing times as UNKNOWN; API permits one weekday interval | Explicit non-null conditional checks, quarter-hour buffer snapshots and occupied instants; proposed SEGMENT_NO for overnight segments. Oracle partially-null unique keys already enforce equal remaining key components, so no null-uniqueness workaround is assumed. [Constraints](../database/relationships-and-constraints.md) | Accept buffer/overnight policy and deliberate API schema change before schedule migration/routes |
| Q-07 | Confirmation pricing versus already-quoted hold | Protect committed hold quote; snapshot price-rule ID, rate, currency, buffers/policy; start-time hourly rule and half-up line rounding. [Booking](../database/booking-invariants.md) | Policy acceptance before pricing/hold workflows |
| Q-08 / Q-14 | Sessions lack audience/active membership; API-addressable tables lack public UUIDs | Session audience + all-or-none membership/user FK; explicit public IDs listed in dictionary, associations keep composite PKs. [Dictionary](../database/data-dictionary.md) | Shape acceptance before migration/auth; cookie/proxy trust remains separate |
| Q-09 / Q-11 | Hash-only tokens cannot be reconstructed for async email/replay; notification tenant is required even for pre-tenant account mail; nullable scope can bypass log FK | Proposed external-key deterministic purpose-separated HMAC token derivation with record UUID/key version and stored digest only. Scoped platform/tenant notification/log records with non-null normalized scope FK; global/email-only templates. Outbox enqueue is atomic; jobs use fenced leases. [Operations](../database/operational-data.md) | Security/operational schema review before implementation; key access/rotation must be tested |
| Q-17 | Invitation branch list exists in API but no pending assignment storage | Add INVITATION_LOCATIONS composite PK and tenant-safe invitation/location FKs; recheck every role/branch on acceptance and create STAFF_ASSIGNMENTS atomically. No owner invite expansion. | Structural approval before staff schema/auth linking |
| Q-10 | Source term rows do not preserve assigned plan limits; suspended current term omitted from unique-current index | Add immutable subscription term/feature snapshots, proposed SCHEDULED future-renewal state, include SUSPENDED among current rows, tenant-gated overlap/date checks. [Finance](../database/financial-rules.md) | Structural/lifecycle acceptance before subscription migrations; no automatic billing |
| Q-02 / Q-20 / Q-22 | Three active payment labels versus five source states; OTHER method/sport extra; refund versus collection/outstanding ambiguity | Propose full venue settlement/refund only, zero-value PAID/no receipt, no overpayment/recollection after refund/cancellation; document all five derived states and precedence. Restrict venue methods to three; seed eight named sports. Separate service-date value, receipt-date collection and refund-date net reporting. [Finance](../database/financial-rules.md) | Product decision before finance workflow; partial labels remain dormant, not approved |
| Q-19 | Retry key lacks proven owner/lease; original-envelope replay conflicts with fresh Step 04 request IDs | Add owner scope/type, execution state/fencing, safe payload/status cache; re-authorize replay and reconstruct current request envelope. No raw bearer credential persisted. | Security/shape acceptance before idempotency implementation; numeric TTL remains Q-23 |
| Q-21 | Holiday deactivation has no status; booking preference/policy snapshots absent; invoice number URL omits tenant while key is tenant-qualified | Add holiday status and relational booking preference/policy snapshots. Require tenant-qualified invoice resolution or separately approve global invoice numbering. Proposed no automatic customer merges/account links; staff may select an authorized existing customer. Published website edits stay direct as MVP states; no draft-version subsystem added. | Schema review before affected migrations; approve customer matching and invoice route before endpoints |
| Q-23 / Q-13 | Numeric retention, retry timing, trial/grace/access and operational recovery policy not supplied | Record explicit owners/gates; no purge until retention accepted, bounded source retry count 5 proposed, durations/TTL remain configuration to approve. No guessed legal compliance, commercial plan prices or recovery result. | Retention/security before affected jobs; recovery before destructive/commercial work |

Execution blockers are structural proposal acceptance, exact target capabilities/privileges and reviewed executable migrations. Feature-specific gates can follow in their owning step if no incompatible schema assumption is committed: trial/grace durations, permission mapping, customer matching, invoice addressing, retention, abuse thresholds and provider policy. A conditional design can be reviewed now; it is not unconditional permission to deploy or run the broad bootstrap.

## D-14 ? Step 06 implementation boundary (20 November 2026)

The explicit Step 06 prompt authorizes account scripts and runtime connectivity only, with distinct SPORTIFY_API and SPORTIFY_WORKER accounts. Retain the Step 05 SPORTIFY_SCHEMA_OWNER name; illustrative SPORTIFY_APP is superseded. Owner uses narrowly required CREATE SESSION/TABLE/SEQUENCE plus finite approved DATA quota, runtimes CREATE SESSION only until reviewed business-object migrations. No runtime/admin identity sharing or generic role bundle is approved.

Use a server-only Thin driver package, per-process bounded pools (API max 8, worker max 2), reset UTC at every checkout, exact NUMBER strings and explicit timestamp projections, explicit transactions without write retries, and Oracle-required readiness. Walletless TLS follows the source preference **as an implementation assumption only**. A real target and actual TLS-versus-mTLS mode were not provided; mode confirmation, secure credentials, provisioning and live verification remain blocked gates. This does not approve a cloud/network change or claim an actual instance permits TLS. Prior unresolved product/schema policy questions are unchanged; no business tables or Step 07 work is authorized.

## D-15 - Selected mTLS mode for changing developer IPs

The user explicitly selected Secure access from everywhere with required mTLS on the intended Mumbai Always Free Transaction Processing development instance, then reported completing creation. This supersedes D-14's conditional walletless-TLS implementation assumption. Keep the pinned Thin driver, require protected instance PEM wallet material and its separate decryption password, retain strict certificate/server-identity checks and finite pool/timeouts, and implement only this selected mode. This decision does not authorize broad runtime privileges or business tables. The agent has not provisioned accounts or connected to Oracle; actual resource identity/status, secure wallet/password availability and live evidence remain gates. Future production ingress/network policy remains separate deployment work.

## D-16 - Step 07 scoped execution infrastructure and unresolved structures

The explicit Step 07 prompt authorizes a staged authentication/tenancy/facility subset, reference seeds, migration execution and verification, excluding the wider booking/payment/subscription/website/outbox catalog. This changes the earlier all-MVP baseline recommendation to contiguous small phases in the same ledger, with 000001 history, 000002 reference catalogs and 000003 launch sports as the independent initial artifacts. No source upload or applied migration was changed; no Oracle execution is established.

Use an operator-only Node/TypeScript package and explicit statement manifest with exact canonical-metadata/UTF-8-LF SQL checksums. One verified owner session holds DBMS_LOCK release_on_commit FALSE across DDL commits; no fallback or runtime lock rights. Actual ATP capability remains unverified and no grant is automatically applied. Runtime object grants stay empty because implemented HTTP/worker behavior does not use the new objects.

**No new product/security proposal is approved by this record.** The user was asked explicitly to resolve (1) session audience/membership, added UUID/token key-version and invitation-location structures Q-08/Q-09/Q-14/Q-17, (2) quarter-hour buffers/schedule segments/closed-null and holiday deactivation Q-05/Q-06/Q-21, and (3) source-only versus reconciled tenant permission codes Q-18. Answers have not been received. The manifest therefore remains review-gated and the dependent schema/seeds/integrity tests are not represented as implemented. Q-15 registration sequence, session/token lifetimes and later authorization behavior also remain owning-step decisions; no guessed numeric policy is added here.
