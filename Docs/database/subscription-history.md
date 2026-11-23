# Step 09 approved subscription storage rules

**Structural policy approved under D-24; storage installed and Oracle-verified under D-27.** Approval covers the scoped Q-10/Q-21 lifecycle/snapshot/settlement rules only. Commercial values remain explicitly undecided; entitlement enforcement is not implemented. [Verification and operator gates](step09-verification.md).

## Catalog and historical terms

SUBSCRIPTION_PLANS is a platform catalog with stable public plan code, enabled/retired state, exact NUMBER(12,2) price, currency and billing interval. No paid/free plan, feature code, quota, trial length or price is seeded. Catalog ownership does not grant tenant users permission to edit it. The draft deliberately removes source defaults for price, currency, interval and trial days: all four require explicit approved commercial input, including any intentional zero price or no-trial value.

SUBSCRIPTION_ENTITLEMENTS uses the explicit BOOLEAN/LIMIT discriminator. BOOLEAN requires absent limit/unit; LIMIT requires a nonnegative limit and nonblank unit. Both require explicit enabled state; the catalog has no implicit enabled default. Negative numbers never mean unlimited. An approved feature registry and compatible units must be validated by later application logic; arbitrary new types or JSON EAV are excluded.

SUBSCRIPTIONS freezes plan name, price, currency and interval when assigning a term. SUBSCRIPTION_FEATURE_SNAPSHOTS freezes its feature definitions in the same transaction. This additional table is already in the disposition matrix and is necessary to prevent later plan edits changing historical entitlements. Invoices reference that retained term and freeze their own period, amount and currency. A plan edit does not propagate to existing snapshots. Row CHECKs do not make snapshots immutable against their owner: later grants and authorized services must prevent those edits. No automatic tax, discounts, credit notes or billing is implemented.

## Approved term structure; durations undecided

Allowed stored states are SCHEDULED, TRIAL, ACTIVE, PAST_DUE, GRACE, SUSPENDED, EXPIRED and CANCELLED. One conditional unique index admits only one TRIAL/ACTIVE/PAST_DUE/GRACE/SUSPENDED term per tenant. SCHEDULED terms remain outside that index. All effective intervals are half-open. Trial fields are paired and inside the term; TRIAL requires them, GRACE requires its bounded grace end. Numeric durations remain commercial inputs, not defaults invented here.

Future assignment/renewal copies catalog terms under a plan lock, then tenant lock, and validates all overlapping periods under that tenant gate. Plan editing locks the plan and must not acquire tenant locks afterward. Current-term uniqueness alone does **not** exclude interval overlaps. Renewal must close the previous current term and activate the next atomically. Time passing does not mutate stored status. Actual expiry/trial/grace eligibility and tenant suspension remain separate authorized application decisions; no trigger suspends tenants or deletes history.

## Approved manual invoice settlement structure

Platform subscription receipts are distinct from venue PAYMENTS/REFUNDS. Positive manual SUBSCRIPTION_PAYMENTS use a tenant/invoice/currency FK chain and a matching PLATFORM_ADMINS/global-user actor pair. Invoice numbers are tenant-qualified; future number-only admin APIs must also resolve tenant context (or obtain separate global-number approval).

D-24 allows multiple receipts up to the outstanding amount. It does not change D-21's full-only venue payment policy. Lock tenant, subscription, invoice and relevant receipt rows in a consistent order; compute effective RECEIVED totals with exact decimal values; reject overpayment; commit receipt, derived invoice state, audit and outbox intent together. Reversal takes the same invoice gate, retains the original receipt as VOIDED and records time, reason and matching platform-admin/user pair. Reconciliation precedes voiding a paid invoice. Neither a positive CHECK nor a currency FK enforces aggregate caps or legal transitions.

Input amounts must reject excess scale/range before binding: Oracle NUMBER(12,2) can round extra fractions. Use decimal strings for exact amounts/IDs; do not pass binary float totals or globally coerce NUMBER to JavaScript number. Invoice PAID requires an authorized aggregate calculation, not a timer or an inserted unpaid invoice. Idempotency for future posting is a separate reviewed transaction concern. No subscription receipt API, concurrent allocation service or payment gateway exists.
