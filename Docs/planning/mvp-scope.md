# MVP scope

Step 11 refines owner registration. Global signup collects the owner's name, email and mobile. The mailbox holder confirms the profile and tenant name and sets the final password. This transition creates the pending-onboarding tenant and initial owner role. Legal profile, address and primary sport are collected during onboarding. [D-30](decision-register.md#d-30--step-11-registration-and-email-verification)

Status: **awaiting user review**. This is a documentation baseline, not an implementation claim. Source codes resolve through the [source register](../README.md#source-register); conflicts and recommendations are in the [decision register](decision-register.md).

## Product and actors

SPORTIFY enables independent Sri Lankan sports businesses to configure facilities, publish a branded booking website, accept guest bookings and operate their daily business through a tenant-isolated dashboard. One business is one tenant; multiple branches are subject to plan entitlements. MVP §§1–3 and 13 define the first release.

| Actor | Primary workflow and boundary |
|---|---|
| Guest customer | Open one venue's website, select sport/branch/resource/time, obtain a hold, enter name and mobile with optional email, confirm, receive reference and payment instructions |
| Business Owner | Register, verify email, save/resume onboarding, configure facilities and website, publish, manage staff and view business operations and own subscription |
| Business Manager | Manage authorized daily operations and assigned branches; sensitive staff, website and financial actions depend on explicit permission |
| Receptionist | Find availability, create manual bookings, look up customers and record receipts within assigned branches; cancel only if permitted |
| Super Admin | Manage tenants, sports, plans, subscriptions and protected audit/statistics; separate platform authority, not automatic routine tenant customer/payment access |

The public platform website, business dashboard, tenant website and Super Admin dashboard are connected experiences with distinct navigation. Guest accounts, customer booking history and self-service cancellation are deferred (MVP §§3.7, 6.7; API §1.3; UX §§2, 5).

## Included capabilities

| Area | First-release scope |
|---|---|
| Identity and tenancy | Owner registration, email verification, validated mobile number, password reset, sessions, tenant membership, three tenant roles, branch restrictions and controlled platform access |
| Onboarding | Saved progress: business profile, sports, branches/resources, schedules, pricing/rules, branding, preview and publish checklist |
| Sports | Eight configurable initial categories: Futsal, Badminton, Indoor Cricket, Basketball, Volleyball, Tennis, Table Tennis and Swimming; global administration and tenant selection |
| Facilities | Multiple branches and resources, capacity/details/photos, active status, resource schedules, holidays, closures and maintenance conflict handling |
| Pricing and availability | Hourly pricing, allowed booking durations, advance window, buffer configuration, 15-minute booking grid, availability and temporary holds |
| Booking | Guest checkout, automatic confirmation, daily/weekly/facility calendars, list/search/filter/details, manual walk-in/phone/WhatsApp/staff reservations, cancellation, completion and no-show |
| Venue payments | Manual cash, bank transfer and card-at-venue receipt recording; payment history, unpaid amounts and separate manual refund records |
| Customers and staff | Tenant-specific customer directory and permitted history; staff invitations, role/branch assignment and access revocation |
| Websites | One responsive template, configurable branding/content/media, SPORTIFY subdomain, preview and publication after essential setup |
| Reports | Daily/weekly/monthly bookings, counts by sport, cancellation counts, branch/facility revenue; booked value and actual collections shown separately |
| SaaS administration | Trials, plans, entitlements, manual subscription receipts/renewal/extension, tenant suspension/reactivation and platform statistics |
| Cross-cutting quality | English/Sinhala/Tamil core UI, accessibility, responsive layouts, audit, secure uploads, transactional outbox/jobs, operational logging and automated checks |

SQL-001 also seeds `OTHER`; eight named launch sports remain the confirmed baseline. Treatment of the extra seed is recorded in Q-22. Payment `OTHER` and inactive financial states likewise do not automatically become user-facing scope (Q-02, Q-22).

## Core business rules

1. Resolve tenant context from authenticated membership or a validated published hostname. Client-supplied tenant IDs and role labels are not authority. Filter tenant data and enforce tenant-aware relationships, including branch access (MVP §3.1; ARCH §8).
2. Every booking uses the same reservation service. The database must prevent overlapping active reservations, including online/manual races. All required slots succeed together or roll back together (MVP §§3.9, 6.2–6.3).
3. The grid is fixed at 15 minutes for MVP. Starting defaults are minimum 60 minutes, maximum 180 minutes, hold 10 minutes, buffer 0 minutes, timezone `Asia/Colombo`; applicable configuration is server-owned. Hold configuration scope, buffer semantics and overnight behavior remain open (Q-05, Q-06, Q-16).
4. Availability considers branch/resource schedules, holidays, blocks, active bookings and unexpired holds, plus duration/advance/buffer rules. Availability display is advisory; reservation transactions are authoritative (MVP §6.1; API §6.1).
5. Start the checkout timer only after the hold commits. Check expiry during booking operations even if the worker is delayed. Atomically transfer slot ownership to the booking without a release/re-reserve gap (MVP §§6.4–6.5; DB §6).
6. Guest name and mobile are required; email is optional. Keep ownership tokens secret. A reference alone must not expose customer data (MVP §3.7; ARCH §8.6).
7. Successful hold conversion automatically confirms the booking. Payment receipt is independent. Confirmed/unpaid is valid; there is no manual approval queue or gateway prerequisite (MVP §§3.10, 6.5).
8. Price is hourly rate × duration in hours. Server-calculated totals and rate snapshots remain immutable for confirmed bookings. Rate changes during a live hold require Q-07 resolution (MVP §6.6).
9. Staff cancellation requires permission, branch scope, a cancellable upcoming booking and a reason. Release only the booking's slots and retain history. Refunds are separate financial events (MVP §6.7).
10. Maintenance cannot silently override confirmed bookings. Booking/hold/block/schedule mutations need a consistent concurrency design (MVP §6.8; Q-04).
11. Booking lifecycle and financial status are separate. Holds have their own lifecycle. MVP payment labels are `UNPAID`, `PAID`, `REFUNDED`; wider schema states remain dormant until reconciled (MVP §§6.9–6.10; Q-02).
12. Duplicate booking/hold/payment requests must not duplicate reservations or receipts. Replay, ownership and retention details require Q-09 and Q-19 (MVP §6.11; API §2.9).
13. Venue receipts and SPORTIFY subscription receipts are different ledgers. Reports distinguish booking value from collections; no floating-point money calculations (MVP §§3.10–3.14; DB §7).
14. Subscription entitlements are enforced centrally. Suspension prevents new public bookings and preserves records; grace, expiry and existing-hold behavior remain open (MVP §9.7; Q-10).
15. Notification failures must not cancel successful bookings. Verification/invitation email and asynchronous work use retryable database-backed processing; SMS/WhatsApp automation is excluded (ARCH §13; API §10).

## Excluded from first release

Marketplace, custom domains, drag-and-drop page building, multiple advanced templates, online payment gateways, automatic refunds, payment splitting, recurring bookings, automated subscription billing, SMS/WhatsApp automation, loyalty, customer memberships, coaching, equipment rental, tournaments, reviews and native mobile apps are deferred. Advanced analytics, dynamic/peak pricing and coupons are also excluded by MVP §§3.11, 4 and 6.6. Customer self-service cancellation and registered customer workflows are deferred.

Manual booking source `WHATSAPP` records how a request arrived; it does not integrate WhatsApp. Future tables are storage design only, not delivery commitments. Do not expose deferred navigation, fake working controls or inactive endpoints. The [roadmap](development-roadmap.md) contains only MVP work.

## Pilot and commercial boundaries

| Stage | Admission criteria |
|---|---|
| Development/staging | Isolated environments, synthetic data, real Oracle integration validation; no assumption that a mock preview proves a live workflow |
| Controlled pilot | At least two independently operating tenants verified end to end, then a target of 10–15 businesses subject to measured capacity and pilot agreement; tenant isolation, concurrency, critical workflows and operational recovery procedures tested |
| Business-critical commercial release | Verified recovery solution with agreed RPO/RTO, retention and restoration drills. ARCH §17 requires suitable paid ATP; MVP §11 leaves room for another verified solution. Q-13 must be resolved before commercial operations |

Free-tier capacity, ARM64 instance availability, regional service options, storage/session limits and backup capabilities are assumptions to verify at provisioning time. They are not guaranteed entitlements or performance promises. Pilot performance targets are API/availability p95 under 2 seconds, booking under 5 seconds and dashboard under 3 seconds; define and measure a realistic workload before claiming them (ARCH §16.4).
