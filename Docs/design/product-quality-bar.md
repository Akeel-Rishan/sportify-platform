# Product quality bar

Status: **proposed acceptance baseline awaiting user review**. Source direction: PRD §24; MVP §§3.6–3.11; UX §§4–5, 8, 10–13, 17, indexed in the [source register](../README.md#source-register). No screens, design system or fonts are implemented in Step 01. Exact tokens, font selection and component dependencies belong to Step 05 after Step 02 compatibility work.

## Visual direction

SPORTIFY should feel professional and calm while handling busy sports operations. Use deep navy for identity and strong structural anchors, electric blue for primary actions and selection, restrained green for successful outcomes, and white/light-neutral surfaces for readable work areas. Do not use green to imply a payment was received when only the booking is confirmed.

Use one coherent type hierarchy, spacing rhythm, border treatment and component vocabulary across marketing, business, tenant and admin experiences. Venue branding can vary within the single template without breaking accessibility or layout. Establish documented spacing/type tokens rather than arbitrary per-screen values. Prefer readable body text around 16 CSS px, comfortable line height and clear labels; exact choices must pass three-script review.

Visual acceptance requires a clear page title, visible business/branch context, one obvious primary task and a sensible information hierarchy. Avoid decoration that competes with data, unnecessary charts, excessive gradients or inconsistent cards. Charts must answer a real operational question and have equivalent readable data.

## Task-specific standards

| Surface | Acceptance standard |
|---|---|
| Booking calendar | Resource and time axes remain understandable while scrolling; daily/weekly/resource views and legend use text as well as color. Every displayed booking has a keyboard-accessible detail action. Narrow layouts offer an agenda/list alternative |
| Availability | Show venue-local date/time/timezone, duration and server-calculated price. Distinguish available, unavailable, maintenance and current-checkout hold. Do not display availability as a reservation guarantee |
| Checkout | Hide unnecessary single-branch choices; show price, duration, payment preference and cancellation information before confirm. Start countdown after server commitment, explain expiry and preserve safe guest details on conflict |
| Confirmation | Show reference, business/branch/facility, local start/end, amount, policy and contact. Booking and payment statuses use separate labeled indicators; confirmed/unpaid remains unmistakable |
| Staff booking | New manual booking is easy to find from calendar/agenda; retain authorized branch context and quick customer lookup. Booking success and later receipt failure are distinguishable |
| Forms | Persistent labels, required/optional indicators, sensible field grouping, inline errors plus an error summary where useful, retained safe inputs and clear save/resume feedback |
| Financial views | Consistent currency/decimal formatting and alignment; separately label booking value, collected payments, outstanding amount and refunds. State date range and basis. Never invent totals or label sample metrics as live |
| Configuration | Clear required setup checklist, saved progress and validation; conflict messages identify the corrective action without exposing another tenant's data |
| Admin | Strongly distinguish platform context from a tenant business. Confirm sensitive status/plan changes, show the affected tenant and consequence, require reasons where the contract calls for them and provide audit evidence |

## Responsive acceptance matrix

These viewport checks operationalize UX §11. They are acceptance checks, not device-specific designs or implemented breakpoints.

| Width in CSS pixels | Required behavior |
|---|---|
| 360 phone | Guest flow is one column; all text, controls, totals and errors remain readable. Dashboard navigation becomes a drawer; calendars have agenda/list mode. No body-level horizontal overflow. Sticky actions do not cover content, focused fields or keyboard-visible inputs |
| 768 tablet | Owner/receptionist tasks remain fully operable with touch and keyboard; navigation and filters adapt without losing branch context. Tables may scroll inside a labeled region with visible affordance |
| 1280 desktop | Persistent navigation where appropriate, readable calendar/table workspace, sensible content width and grouped filters; avoid stretching short forms across the entire screen |
| Wider desktop / zoom | Maintain useful line lengths and hierarchy; do not inflate content to fill space. At 200% browser zoom, critical information/actions remain reachable without overlap or clipped text |

Test at and between these widths, in portrait/landscape where relevant and with long names, real error text and Sinhala/Tamil labels. Dense grids may have controlled internal scrolling; provide an accessible list alternative. Responsive success is not merely hiding columns that contain required actions or financial information.

## Accessibility acceptance

- Aim for WCAG 2.2 AA as specified by UX §12. Proposed measurable checks: normal text contrast at least 4.5:1, large text at least 3:1, and meaningful control boundaries/focus cues at least 3:1 against adjacent colors. Measure actual approved tokens, including venue branding variants.
- All interactive elements have semantic roles and accessible names. Provide visible labels, field instructions and programmatically associated errors; placeholders are not labels.
- Keyboard navigation reaches every action with logical focus order. Focus remains visible and unobscured; dialogs manage entry/containment/return focus and permit safe dismissal. Never trap keyboard users accidentally.
- Calendar/time-slot controls expose date/time/resource and selected/unavailable state. Use a documented keyboard pattern and provide an agenda alternative.
- Primary touch targets are at least 44 × 44 CSS px, as required by UX §12; separate destructive and primary actions sufficiently to avoid accidental taps.
- Use text/icons alongside colors for all booking, payment and maintenance states. Errors explain the problem and recovery action without blaming users.
- Announce meaningful async status and expiry warnings accessibly. Do not announce a countdown every second. Respect reduced-motion preferences and avoid motion essential to understanding.
- Verify manually with keyboard and a screen reader for core flows; automated checks do not establish complete accessibility conformance.

## Localization and content

- Core flows work in English, Sinhala and Tamil. Select fonts with verified glyph shaping/coverage; inspect mixed-script business names and LKR amounts. No font or package is selected in Step 01.
- Use translation keys outside components. Avoid sentence fragments assembled in English order. Language changes preserve current task state where safe.
- Proposed layout stress check: allow roughly 40% text expansion, plus actual Sinhala/Tamil copy. Wrap labels and buttons without clipping; never rely solely on a fixed-height English screenshot.
- Use configured venue timezone and currency. Display dates/times unambiguously, label totals and keep +94 input usable while server validation uses the agreed E.164 policy.
- Write actionable empty/error states. No-results filters differ from an unconfigured facility list or a failed network request. A loading screen must not briefly show invented zeros.

## Review evidence

For each implemented screen, capture representative desktop/tablet/phone evidence and record keyboard, contrast, localization and state checks. Use synthetic but realistic bookings and names, explicitly labeled when fixtures. Screens backed by mocks remain **preview only** until real API/Oracle workflows pass. UX research hypotheses and the proposed 90% task-completion target cannot be marked validated without actual participants and recorded results.

Use the [definition of done](../quality/definition-of-done.md) for completion evidence and [traceability](../planning/requirements-traceability.md) for requirement status. This quality bar does not authorize UI implementation in Step 01.
