# Step 08 booking and venue finance schema draft

**D-21-approved schema installed and verified on Oracle under D-22.** The six original Step 07 parent structures shown here are already installed; the ten new tables are now installed/catalog-verified as well. Exact columns/checks/indexes, including PENDING_PAYMENT, zero-value PAID and conditional successful-receipt/refund uniqueness, are in the dictionary/register and [Step 08 record](step08-verification.md). No application booking/payment workflow is implemented.

```mermaid
erDiagram
  TENANTS {
    number TENANT_ID PK
    varchar2 PUBLIC_ID
  }
  USERS {
    number USER_ID PK
    varchar2 PUBLIC_ID
  }
  TENANT_USERS {
    number MEMBERSHIP_ID PK
    varchar2 PUBLIC_ID
  }
  BUSINESSES {
    number BUSINESS_ID PK
    varchar2 PUBLIC_ID
  }
  RESOURCES {
    number RESOURCE_ID PK
    varchar2 PUBLIC_ID
  }
  PRICING_RULES {
    number PRICING_RULE_ID PK
    varchar2 PUBLIC_ID
  }
  CUSTOMERS {
    number CUSTOMER_ID PK
    number TENANT_ID FK
    varchar2 PUBLIC_ID
    number USER_ID FK
  }
  BUSINESS_PAYMENT_SETTINGS {
    number BUSINESS_PAYMENT_SETTINGS_ID PK
    number TENANT_ID FK
    number BUSINESS_ID FK
  }
  BOOKING_HOLDS {
    number HOLD_ID PK
    number TENANT_ID FK
    varchar2 PUBLIC_ID
  }
  BOOKING_HOLD_ITEMS {
    number HOLD_ITEM_ID PK
    number TENANT_ID FK
    number HOLD_ID FK
    number BUSINESS_ID FK
    number LOCATION_ID FK
    number RESOURCE_ID FK
    number PRICING_RULE_ID FK
  }
  BOOKINGS {
    number BOOKING_ID PK
    number TENANT_ID FK
    varchar2 PUBLIC_ID
    number BUSINESS_ID FK
    number CUSTOMER_ID FK
    number SOURCE_HOLD_ID FK
    number CREATED_BY_MEMBERSHIP_ID FK
  }
  BOOKING_ITEMS {
    number BOOKING_ITEM_ID PK
    number TENANT_ID FK
    number BOOKING_ID FK
    number BUSINESS_ID FK
    number LOCATION_ID FK
    number RESOURCE_ID FK
    char CURRENCY_CODE FK
    number PRICING_RULE_ID FK
  }
  RESOURCE_SLOT_RESERVATIONS {
    number TENANT_ID PK,FK
    number RESOURCE_ID PK,FK
    timestamp SLOT_START_UTC PK
    number BOOKING_ITEM_ID FK
    number HOLD_ITEM_ID FK
  }
  BOOKING_CANCELLATIONS {
    number CANCELLATION_ID PK
    number TENANT_ID FK
    number BOOKING_ID FK
    number CANCELLED_BY_MEMBERSHIP_ID FK
  }
  PAYMENTS {
    number PAYMENT_ID PK
    number TENANT_ID FK
    number BOOKING_ID FK
    char CURRENCY_CODE FK
    number RECORDED_BY_MEMBERSHIP_ID FK
    varchar2 PUBLIC_ID
    number VOIDED_BY_MEMBERSHIP_ID FK
  }
  REFUNDS {
    number REFUND_ID PK
    number TENANT_ID FK
    number PAYMENT_ID FK
    char CURRENCY_CODE FK
    number RECORDED_BY_MEMBERSHIP_ID FK
    varchar2 PUBLIC_ID
  }
  TENANTS ||--o{ CUSTOMERS : FK_CUSTOMERS_TENANT
  USERS o|--o{ CUSTOMERS : FK_CUSTOMERS_USER
  BUSINESSES ||--o| BUSINESS_PAYMENT_SETTINGS : FK_BPS_BUSINESS
  TENANTS ||--o{ BOOKING_HOLDS : FK_BOOKING_HOLDS_TENANT
  BOOKING_HOLDS ||--o{ BOOKING_HOLD_ITEMS : FK_BOOKING_HOLD_ITEMS_HOLD
  RESOURCES ||--o{ BOOKING_HOLD_ITEMS : FK_BOOKING_HOLD_ITEMS_RESOURCE
  PRICING_RULES ||--o{ BOOKING_HOLD_ITEMS : FK_BOOKING_HOLD_ITEMS_PRICE
  BUSINESSES ||--o{ BOOKINGS : FK_BOOKINGS_BUSINESS
  CUSTOMERS ||--o{ BOOKINGS : FK_BOOKINGS_CUSTOMER
  BOOKING_HOLDS o|--o| BOOKINGS : FK_BOOKINGS_HOLD
  TENANT_USERS o|--o{ BOOKINGS : FK_BOOKINGS_CREATOR
  BOOKINGS ||--o{ BOOKING_ITEMS : FK_BOOKING_ITEMS_BOOKING
  RESOURCES ||--o{ BOOKING_ITEMS : FK_BOOKING_ITEMS_RESOURCE
  PRICING_RULES ||--o{ BOOKING_ITEMS : FK_BOOKING_ITEMS_PRICE
  BOOKINGS ||--o{ BOOKING_ITEMS : FK_BI_CURRENCY
  RESOURCES ||--o{ RESOURCE_SLOT_RESERVATIONS : FK_SLOT_RESERVATIONS_RESOURCE
  BOOKING_ITEMS o|--o{ RESOURCE_SLOT_RESERVATIONS : FK_SLOTS_BOOKING_ITEM
  BOOKING_HOLD_ITEMS o|--o{ RESOURCE_SLOT_RESERVATIONS : FK_SLOT_RESERVATIONS_HOLD_ITEM
  BOOKINGS ||--o| BOOKING_CANCELLATIONS : FK_BC_BOOKING
  TENANT_USERS ||--o{ BOOKING_CANCELLATIONS : FK_BOOKING_CANCELLATIONS_ACTOR
  TENANT_USERS ||--o{ PAYMENTS : FK_PAYMENTS_RECORDER
  BOOKINGS ||--o{ PAYMENTS : FK_PAYMENTS_BOOKING
  TENANT_USERS o|--o{ PAYMENTS : FK_PAYMENT_VOID_ACTOR
  TENANT_USERS ||--o{ REFUNDS : FK_REFUNDS_RECORDER
  PAYMENTS ||--o{ REFUNDS : FK_REFUNDS_PAYMENT
```

Conditional unique UX_BOOKINGS_SOURCE_HOLD prevents two non-null conversions while allowing repeated manual bookings with no source hold. REFUNDS links to PAYMENTS and its currency; booking identity is derived through the payment, without an independently mutable refund booking ID. Slot ownership includes the exact same tenant/resource/item tuple.
