# Booking invariants and transaction design

Status: **proposed implementation design, awaiting review** (Q-04-07, Q-09-10, Q-16, Q-19). No workflow is implemented or Oracle-tested. [Dictionary](data-dictionary.md) owns columns; [constraints](relationships-and-constraints.md) owns exact checks/keys.

## Enforcement boundaries

| Invariant                     | Database                                                                                                         | Transaction/application                                                        | Background cleanup                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| One occupied resource/slot    | PK RESOURCE_SLOT_RESERVATIONS(TENANT_ID,RESOURCE_ID,SLOT_START_UTC)                                              | Insert complete slot set; roll back entire operation on any conflict           | Never substitutes for uniqueness                              |
| Exactly one owner             | CK_SLOT_RESERVATIONS_OWNER: booking item XOR hold item                                                           | Set BOOKING_ITEM_ID and HOLD_ITEM_ID in one UPDATE during conversion           | Delete only the expired owner's rows                          |
| Correct owner resource/tenant | FK_SLOTS_BOOKING_ITEM and FK_SLOT_RESERVATIONS_HOLD_ITEM use tenant/item/resource; parent resource UKs are exact | Resolve trusted tenant/branch and authorize; FKs do not grant read access      | Same tenant/resource protocol                                 |
| Aligned positive duration     | Existing item/grid/range checks; non-null duration and instants                                                  | Resource bounds and all occupied slots, exactly one item/header in MVP         | None                                                          |
| Complete slot coverage        | Individual rows unique; interval coverage is not a CHECK guarantee                                               | Assert count and exact slot set for occupied interval before commit            | Verify invariants, never invent missing reservations silently |
| Maintenance exclusion         | No third slot owner and no exclusion constraint is claimed                                                       | Shared locking protocol and overlap recheck for every reservation/block change | Same protocol; cannot override a booking                      |
| Valid price/currency          | Nonnegative money, explicit currency keys                                                                        | Decimal calculation, header sum, chosen rate and immutable snapshots           | No repricing                                                  |
| Valid hold deadline           | Expiry after creation check; server UTC clock                                                                    | Compare deadline after acquiring locks, not only before waiting                | Supplementary reclamation only                                |

## Time, occupancy and pricing

- Service and occupied intervals are half-open: `[start,end)`. Adjacent intervals sharing an endpoint do not overlap. Overlap predicate: `existing_start < requested_end AND existing_end > requested_start`.
- Convert venue-local selection using LOCATIONS.TIMEZONE_NAME. Initial supported zone is Asia/Colombo; tenant default is copied when a location is created. A later tenant-default change does not silently change existing locations. Timezone changes affecting future reservations need an explicit audited policy; reject casual re-zoning once future bookings exist.
- Local and resulting UTC instants must be aligned to 15 minutes with zero fractional seconds. Reject nonexistent/ambiguous wall times; do not guess or use browser timezone. For future zones validate actual timezone-file support and DST folds/gaps. Colombo examples: local 2026-11-20 19:00-20:00 becomes UTC 13:30-14:30, four play slots.
- Snapshot BUFFER_BEFORE_MINUTES and BUFFER_AFTER_MINUTES as nonnegative multiples of 15. Occupancy is `[start-before,end+after)` and reserves every slot under the same item. Before=15/after=15 for the example reserves UTC 13:15 through 14:30 slot starts (six rows), ending 14:45. Buffers cannot overlap other occupancy and must fit allowed schedules/closures. Charge only service duration. This is the proposed Q-05 policy, not an approved UI promise.
- Proposed Q-06 target supports cross-midnight service with OPERATING_HOURS.SEGMENT_NO, splitting overnight hours across local dates. Intersect branch hours, resource restrictions and each date's holiday policy for the entire occupied interval. Missing hours mean unavailable. Multiple segments cannot overlap; a closed day cannot also have open segments. Breaks use blocks or separated segments. HOLIDAYS has one branch/date override; complex multi-segment holiday reductions require blocks, not an invented holiday JSON structure. Current API one-entry-per-weekday contract must be deliberately amended before exposing multi-segment scheduling.
- Minimum/maximum 60/180 minutes, 15-minute slots and zero buffers are source starting values; applicable settings remain configurable. Source advance window 30 days is a proposed initial setting, not an inferred product approval. Ten-minute hold duration is the source default; central versus tenant-specific configuration remains Q-16.
- Proposed Q-07: select one active rate effective at service start for the full service duration, calculate decimal `ROUND_HALF_UP(hourly_rate * duration_minutes / 60,2)` once per line, and honor the committed hold quote until expiry. Copy rate, total, currency, price-rule reference, buffers and cancellation policy into the booking. An expired/reacquired hold gets a new reviewed quote. No dynamic/tier pricing is introduced.

## One locking order

Hold states are ACTIVE -> CONVERTED, EXPIRED or RELEASED; each terminal state retains header/items. Booking/item mapping is CONFIRMED/ACTIVE, CANCELLED/CANCELLED, COMPLETED/COMPLETED and NO_SHOW/COMPLETED (the item means finalized occupancy; attendance is the parent status). No source item NO_SHOW enum is invented. These are service transitions with audit, not CHECK guarantees about the prior state.

Use ordinary bounded `FOR UPDATE` waits for domain writes; do not SKIP LOCKED a resource and misreport it available. Proposed conservative MVP protocol:

```text
0. Global plan/reference rows, if a write needs locks there (ascending internal ID).
1. TENANTS row: one short admission mutex for this tenant.
2. Existing relevant SUBSCRIPTIONS rows (ascending subscription ID).
3. LOCATIONS rows (ascending location ID).
4. RESOURCES rows (ascending resource ID).
5. BOOKING_HOLDS rows (ascending hold ID).
6. BOOKINGS rows (ascending booking ID).
7. PAYMENTS rows (ascending payment ID).
8. SUBSCRIPTION_INVOICES rows (ascending invoice ID).
9. IDEMPOTENCY_KEYS rows (stable full unique-key order), then append audit/outbox.
```

Skip unused levels; never acquire an earlier level after a later one. Sort NUMBER identifiers numerically in SQL/exact decimal arithmetic, never lexicographically or via lossy JS Number. Do not modify multiple tenants in one domain transaction. Published plan edits/assignment take the plan lock before tenant; ordinary booking admission reads assigned immutable entitlement snapshots and does not later lock the global plan. No network calls occur while these locks are held.

The tenant mutex intentionally serializes relevant writes within a tenant. It is a correctness-first proposal requiring contention/load tests, not a claim of scalable throughput. All reservation, hold release/expiry, cancellation, maintenance, schedule, pricing, resource creation/deactivation and admission/subscription changes must participate. Read-only availability stays advisory. A future finer-grained protocol requires a new reviewed race proof.

Read identifiers optimistically for discovery only. After the tenant lock, re-read membership, subscription, target rows and complete affected resource set. Include every resource/location owned by any stale multi-resource hold that might be expired. Acquire the complete sorted resource set before hold/header locks; if discovery changes, roll back and restart with an expanded set. Under the tenant mutex conforming writers cannot add phantoms, but the recheck still detects stale discovery. Existing foreign keys alone do not enforce this write protocol.

Worker queue claiming commits before domain work begins. Never retain a JOB_QUEUE/outbox claim row lock while waiting for a tenant/resource. A claimed job starts a fresh domain transaction using the same order; final acknowledgement uses its fencing token in another short transaction. This avoids queue-to-tenant lock inversion.

## Shared operation prelude

All pseudocode below means a single transaction with autocommit disabled:

```text
resolve tenant and caller ownership/permissions on server
validate syntax; discover complete target and stale-hold resource sets (not authoritative)
BEGIN; take locks in the exact order above; re-read scope/state after locking
recheck tenant suspension, effective subscription dates/snapshot entitlements and branch access
find/claim owner-scoped idempotency row at its final lock level where required
for a replay: re-authorize owner/resource, compare fingerprint, return saved payload/status
on any unexpected failure, deadlock, timeout, slot conflict or lost lease: ROLLBACK ALL
only bounded whole-operation retries with the same owner-scoped key are permitted
```

Expiry/cancellation/refund reconciliation must remain possible for retained history even when admission of new bookings is denied. Their permissions/policy checks differ from new-reservation admission; do not accidentally block cleanup because a tenant is suspended.

## Create hold

```text
shared prelude; lock all relevant resources and stale hold headers
read database UTC now = CAST(SYS_EXTRACT_UTC(SYSTIMESTAMP) AS TIMESTAMP(6)) after waiting
for stale ACTIVE holds whose expires_at_utc <= now: run expiry transition below in this TX
recheck hours, holidays, blocks, all resource flags, local/UTC grid, buffers and advance window
choose price; insert ACTIVE hold with future database-derived expiry and quote/policy snapshots
insert exactly one hold item for MVP; compute full occupied slot set
insert all slot rows with HOLD_ITEM_ID set, BOOKING_ITEM_ID null
assert row count/coverage; persist safe idempotency result and required audit/outbox
COMMIT; only now return hold/expiry and start client countdown
```

Map a unique-slot violation to a safe conflict after rollback, not partial success. Manual booking uses this same admission/slot algorithm and lock order, but inserts a confirmed booking/item directly with no hold or alternate reservation table.

## Confirm hold

```text
discover the hold's complete resource set; shared prelude; lock resources before hold header
verify trusted checkout proof, hold digest, tenant, ACTIVE state and current entitlement policy
re-read database UTC time; require expires_at_utc > now
verify the exact owned slot set still exists and belongs to this hold's items/resources
resolve/create customer under the tenant using reviewed matching policy (no automatic global link)
insert booking and exactly one booking item; copy committed quote/buffers/policy without repricing
validate enabled payment preference; set CONFIRMED, normally UNPAID (zero-value policy Q-02)
fresh deadline comparison immediately before moving ownership; expired => no conversion
UPDATE each owned slot SET BOOKING_ITEM_ID=new_item, HOLD_ITEM_ID=NULL atomically
require expected count; mark hold CONVERTED and converted_at_utc; source_hold uniqueness guards retry
write audit/outbox and safe owner-scoped replay result; COMMIT
```

The validity linearization point is the final under-lock deadline check; commit may complete shortly later. This does not promise a database constraint enforcing wall-clock expiry at commit. Conversion never deletes then reacquires slots. If any step fails, the original active hold/slots remain intact through rollback. A later legitimate expiry can then reclaim them. Converted holds are history, not bearer authority for future customer lookup.

## Expire or voluntarily release hold

```text
discover all item/resources; BEGIN and lock tenant/subscription-if-needed/location/resource/hold in order
re-read current state and database UTC clock
if not ACTIVE: return current terminal state; do not delete somebody else's reservations
expiry path requires expires_at_utc <= now; release path requires proved checkout ownership
DELETE only slot rows joined to this tenant's hold items, preserving any converted booking owners
mark EXPIRED or RELEASED and released_at_utc; write required audit; COMMIT
```

All-or-nothing expiry covers the entire hold. Retain header/items. A delayed worker never authorizes treating stale physical rows as reusable without locked cleanup. Read-only availability may ignore an expired hold logically, but only the transaction above makes its slot keys reusable. Confirmation and expiry serialize on the same gates/headers and recheck state after locks.

## Cancel booking

```text
discover all booking item/resources; BEGIN, take gates/resources then booking lock in order
re-authorize tenant/branch/booking.cancel; require CONFIRMED and upcoming service start
same terminal cancellation retry returns history; other terminal state => conflict
require reason; mark booking CANCELLED and items CANCELLED
insert one BOOKING_CANCELLATIONS row (unique tenant/booking); MVP source STAFF only
DELETE only slots still owned by those booking items under the same tenant/resources
write immutable audit/outbox; COMMIT
```

No payment/refund row is overwritten or automatically created. ADMIN/SYSTEM cancellation labels in the broad source remain dormant until an actor/authorization design is accepted; never fabricate a tenant membership for a worker. Completion/no-show preserve history and have separate authorized terminal transitions. Past slot retirement is a later retention operation; bookings in the past are never admitted.

## Create/change/cancel maintenance

```text
discover union of old/new interval resources; for location-wide blocks include every location resource
BEGIN; tenant gate, location gates, complete sorted resources, relevant stale holds, related booking locks
recheck resource set and latest block/state; expire stale holds through the same protocol
check overlap using occupied intervals (including buffers), not service duration alone
if any active booking or unexpired hold conflicts: ROLLBACK and return safe conflict
insert/update/cancel AVAILABILITY_BLOCKS; never insert a maintenance-owned slot row
write audit/outbox; COMMIT
```

Blocking active holds as well as confirmed bookings is the proposed conservative Q-04 rule. Staff must explicitly resolve a booking first; no silent cancellation. A concurrent booking gets the tenant/resource gate either before the block (block rejects) or after it (booking rejects); both cannot succeed for overlapping intervals if all writers follow the protocol. Location-wide blocks also cover resources created later because creation uses the same tenant/location gate and future admission rechecks the block. Changes examine both old/new intervals; cancellation does not delete booking history.
