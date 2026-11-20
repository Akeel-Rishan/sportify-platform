# Venue finance and manual subscriptions

Status: **proposed decisions for review**, especially Q-02, Q-07, Q-10, Q-20 and Q-23. The dictionary contains the proposed exact columns/status checks; this document owns calculations/transitions. No payment or subscription workflow is implemented.

## Money and immutable evidence

Store NUMBER(12,2), explicit uppercase currency, and send decimal strings to/from application/API. Validate finite decimal syntax, <=2 fractional digits and <=9999999999.99 before binding; Oracle numeric scale may round otherwise. Do not first convert money through JS Number. Compute minor units with exact integers/decimal arithmetic, round half-up once per line, then sum rounded lines. Initial supported transactional currency is LKR (two decimals); future currencies require explicit scale policy. No FX, discounts, gateways, split tenders or automatic subscription billing are enabled.

Hold/booking item rate, price-rule reference, duration, currency, occupied interval and buffer snapshots are immutable. Booking header total is the exact sum; one item per MVP booking is a service invariant. Cancellation policy/customer snapshots are also fixed evidence. Pricing edits affect new quotes only, subject to proposed hold-price protection in [booking invariants](booking-invariants.md).

PAYMENTS/REFUNDS are customer-to-venue records. SUBSCRIPTION_INVOICES/SUBSCRIPTION_PAYMENTS are tenant-to-SPORTIFY records. They share no ledger IDs and cannot be substituted in reports. Currency FKs enforce booking-to-receipt-to-refund and subscription-to-invoice-to-payment agreement. Bank/account instructions are restricted venue configuration, not payment-card credentials.

## Posting, corrections and refunds

- A venue receipt is inserted RECEIVED with positive amount, supported manual method (CASH, BANK_TRANSFER, CARD_AT_VENUE), occurrence time, optional reference and authorized recorder membership. Reference is evidence/search data, not a globally unique idempotency key; cash may have no reference. Require a reference for bank transfer/card where business policy requires it; Q-23 must finalize that rule. Never mark paid from a booking preference alone.
- Lock the tenant gate, booking and all affected payment rows using the shared order. Compute existing effective totals and remaining collection capacity under those locks. Reject overpayment; do not silently credit another booking or allocate excess. Proposed MVP receipts must settle the full outstanding uncollected value, because partial payment is not approved.
- Original amounts/method/reference/occurrence/recorder are never edited after posting. Correct an erroneous receipt through VOIDED plus required void actor/time/reason and append audit, retaining the row. A replacement is a new receipt in the same locked correction transaction where appropriate. Voiding a receipt with processed refunds is forbidden until a separately reviewed reconciliation procedure exists. A void records an accounting correction, not a real-world cash refund.
- A refund is a separate positive REFUNDS row linked to the original receipt, with reason, processed time and recorder. Manual recording does not move money. Proposed MVP records directly as PROCESSED; REQUESTED/REJECTED source states remain dormant unless an approval workflow is explicitly accepted. Cancellation does not generate a refund.
- For each payment, `processed_refunds <= original_amount` and no processed refund may reference a VOIDED receipt. Lock booking, then affected payments in numeric ascending order and recompute caps immediately before posting. All relevant posting/void/refund/summary changes and audit/idempotency effects commit or roll back together. Two simultaneous full refunds must yield one winner.
- Use owner/tenant/operation-scoped idempotency keys. A same-key retry must not append a second receipt/refund. Recheck authorization before replay. Do not use transaction reference or amount/date heuristics as retry protection.

## Derived balances and summary precedence

Let `T` be immutable booking value, `P` the sum of nonvoided RECEIVED receipts, `R` the sum of PROCESSED refunds linked to those receipts, and `N=P-R` the net received amount. Enforce `0 <= R <= P <= T` for the proposed venue MVP. Refunding does not reopen collection capacity. Uncollected value is `max(T-P,0)`; collectible outstanding is that value only while collection is allowed, otherwise 0 for cancelled/refunded terminal policy. Display net received separately from outstanding.

Evaluate summary rules in this order:

| Condition             | Payment summary    | MVP policy                                                                 |
| --------------------- | ------------------ | -------------------------------------------------------------------------- |
| `P>0 AND R=P`         | REFUNDED           | Full manual refund; no synthetic negative receipt                          |
| `0<R<P`               | PARTIALLY_REFUNDED | Catalog calculation only; proposed dormant                                 |
| `T=0 AND P=0 AND R=0` | PAID               | Proposed zero-value settled/no-payment-due behavior; no fabricated receipt |
| `P=T AND R=0 AND T>0` | PAID               | Fully collected                                                            |
| `0<P<T AND R=0`       | PARTIALLY_PAID     | Catalog calculation only; proposed dormant                                 |
| `P=0 AND R=0 AND T>0` | UNPAID             | No effective receipt                                                       |

Impossible/out-of-range combinations are reconciliation failures, not values to force into PAID. Refund precedence takes priority over payment coverage. Q-02 is unresolved: MVP/API specify only UNPAID/PAID/REFUNDED while source constraints allow five states. Proposed active workflow permits one full settlement, controlled full correction, and a full remaining refund; no receipt after a processed refund or cancellation. A broader partial/refund/recollection model needs explicit approval, revised balance policy and UI/contract tests. The five source enum values remain documented; their presence does not enable partial workflows.

Booking lifecycle and payment summary are independent. CONFIRMED/UNPAID is valid; CANCELLED/PAID is valid until staff records an approved separate refund. Do not set a cancelled booking's original total to zero to fake reconciliation. Zero-value initial status differs from the source's normal unpaid-confirmation example and remains a review gate.

## Reporting

Booking value is service-date value grouped in venue-local time, with cancelled booking value reported separately/excluded from active-booked-value totals. Collections use receipt occurrence date; refunds use processed occurrence date and are shown separately. Net collections = nonvoid receipts minus processed refunds in the selected period; it is not the sum of booking headers. These are proposed Q-20 definitions requiring product acceptance. Keep creation date, service date and cash date distinct; a cancellation in a later month does not rewrite prior cash history. Every report is tenant/branch authorized before aggregation.

## Subscription terms, renewal and entitlements

SUBSCRIPTIONS records dated assignment/renewal terms. Freeze plan name, price, currency, billing interval and the per-feature SUBSCRIPTION_FEATURE_SNAPSHOTS at assignment. Plan edits affect new assignments/renewals, not previously assigned limits or prices. Lock a plan before tenant when copying its price/features, preventing mixed-version snapshots; an admin plan edit locks that plan and never subsequently attempts tenant locks. Historical global plan rows stay referenced and cannot be hard deleted. No plan prices, feature codes or commercial quotas are invented as approved seeds.

SUBSCRIPTION_INVOICES stores immutable invoice number, currency, due amount and term boundaries; its original number uniqueness remains tenant-qualified. Because a source admin URL identifies only invoiceNumber, the API must also resolve/require tenant context or separately approve a globally unique invoice number before implementation (Q-21). Draft edits are allowed before issue; issued financial facts are fixed. Invoice lifecycle DRAFT -> ISSUED -> PAID/OVERDUE or VOID under authorized audit. Manual invoice receipts are positive, capped by outstanding and currency-matched. Multiple invoice receipts can settle an invoice unless product policy restricts them; this does not enable venue payment splitting. Corrections retain receipts and required void metadata. Posted payments require an actual matching PLATFORM_ADMINS/global-user actor; authorization is still checked at posting time. Voiding an invoice with received money requires explicit reconciliation, not deletion.

| Subscription state | Meaning and proposed transition                                                             |
| ------------------ | ------------------------------------------------------------------------------------------- |
| SCHEDULED          | Proposed new state for a future manual renewal term; no current entitlement until its start |
| TRIAL              | Current time inside trial interval; entitlement snapshot enforced                           |
| ACTIVE             | Current valid paid/authorized term                                                          |
| PAST_DUE           | Billing issue requiring policy evaluation, not an unconditional healthy state               |
| GRACE              | Explicit bounded grace window if approved; no invented grace duration                       |
| SUSPENDED          | Explicitly blocked term; still counts as the current assignment until closed/replaced       |
| EXPIRED            | Term ended and not granted valid grace/renewal                                              |
| CANCELLED          | Term explicitly ended; history remains                                                      |

Proposed unique current-term index includes TRIAL/ACTIVE/PAST_DUE/GRACE/SUSPENDED. SCHEDULED terms are excluded but overlap and duplicate renewal periods must be checked under the tenant gate (no exclusion constraint is claimed). On renewal activation, atomically end the previous current row and activate the next snapshot term. Jobs may advance state, but every request evaluates actual database time and can reconcile an eligible scheduled term under the same locks; delayed jobs cannot extend expired access. Starts/end boundaries are half-open and existing current terms cannot overlap. Trial date pairs must both exist together when used; dates/explicit state alone must not imply a commercial entitlement without policy approval.

TENANTS.STATUS is an independent operational gate: tenant SUSPENDED/CLOSED denies new public holds/conversions even if a subscription is ACTIVE. Proposed Q-10 also denies new manual reservations and configuration expansion while preserving authorized historical reads, outstanding reconciliation, refunds and owner renewal access; cleanup/cancellation remain available. Downgrades cannot delete excess branches/resources/staff: retain history and require a reviewed restriction/resolution policy. Exact grace, trial start/length, reactivation, scheduled-term activation, subscription override permissions and plan limits are Q-10/Q-23 review blockers before those workflows are enabled. No automatic billing/gateway charge is introduced.
