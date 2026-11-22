# Venues And Bookings

Implementation overlay: this remains the **full proposed Step 05 design**, not an installed Step 07 schema. See [implemented SQL versus pending/Oracle-unverified structures](implemented-schema.md).

Proposed MVP logical diagram. Only included tables appear; shared parent context may repeat across diagrams. Exact columns/composite keys, optional checks and source deviations are in [relationships](relationships-and-constraints.md). Lines summarize multiple related FKs; nullable global scopes do not waive the non-null scope guard. Cardinality shown is schema capacity, not proof of required onboarding/item rows.

```mermaid
erDiagram
    direction LR
    LOCATIONS ||--o{ AVAILABILITY_BLOCKS : tenant_FK
    RESOURCES o|--o{ AVAILABILITY_BLOCKS : tenant_FK
    TENANT_USERS ||--o{ AVAILABILITY_BLOCKS : tenant_FK
    BUSINESSES ||--o{ BOOKINGS : tenant_FK
    CUSTOMERS ||--o{ BOOKINGS : tenant_FK
    BOOKING_HOLDS o|--o| BOOKINGS : tenant_FK
    TENANT_USERS o|--o{ BOOKINGS : tenant_FK
    BOOKINGS ||--o| BOOKING_CANCELLATIONS : tenant_FK
    TENANT_USERS ||--o{ BOOKING_CANCELLATIONS : tenant_FK
    TENANTS ||--o{ BOOKING_HOLDS : global_or_root_FK
    BOOKING_HOLDS ||--o{ BOOKING_HOLD_ITEMS : tenant_FK
    RESOURCES ||--o{ BOOKING_HOLD_ITEMS : tenant_FK
    PRICING_RULES ||--o{ BOOKING_HOLD_ITEMS : tenant_FK
    BOOKINGS ||--o{ BOOKING_ITEMS : tenant_FK
    RESOURCES ||--o{ BOOKING_ITEMS : tenant_FK
    PRICING_RULES ||--o{ BOOKING_ITEMS : tenant_FK
    TENANTS ||--o| BUSINESSES : global_or_root_FK
    BUSINESSES ||--o| BUSINESS_PROFILES : tenant_FK
    BUSINESSES ||--o{ BUSINESS_SPORTS : tenant_FK
    SPORTS ||--o{ BUSINESS_SPORTS : global_or_root_FK
    TENANTS ||--o{ CUSTOMERS : global_or_root_FK
    LOCATIONS ||--o{ HOLIDAYS : tenant_FK
    BUSINESSES ||--o{ LOCATIONS : tenant_FK
    BUSINESSES ||--o{ ONBOARDING_PROGRESS : tenant_FK
    LOCATIONS ||--o{ OPERATING_HOURS : tenant_FK
    RESOURCES o|--o{ OPERATING_HOURS : tenant_FK
    RESOURCES ||--o{ PRICING_RULES : tenant_FK
    BUSINESSES ||--o{ RESOURCES : tenant_FK
    LOCATIONS ||--o{ RESOURCES : tenant_FK
    BUSINESS_SPORTS ||--o{ RESOURCES : tenant_FK
    RESOURCES ||--o{ RESOURCE_FEATURES : tenant_FK
    RESOURCES ||--o{ RESOURCE_SLOT_RESERVATIONS : tenant_FK
    BOOKING_ITEMS o|--o{ RESOURCE_SLOT_RESERVATIONS : tenant_FK
    BOOKING_HOLD_ITEMS o|--o{ RESOURCE_SLOT_RESERVATIONS : tenant_FK
    BUSINESSES ||--o{ WEBSITE_MEDIA : tenant_FK
    LOCATIONS o|--o{ WEBSITE_MEDIA : tenant_FK
    RESOURCES o|--o{ WEBSITE_MEDIA : tenant_FK
    BUSINESSES ||--o| WEBSITE_SETTINGS : tenant_FK
    WEBSITE_THEMES ||--o{ WEBSITE_SETTINGS : global_or_root_FK
    AVAILABILITY_BLOCKS {
        number AVAILABILITY_BLOCK_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    BOOKINGS {
        number BOOKING_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    BOOKING_CANCELLATIONS {
        number CANCELLATION_ID PK
        number TENANT_ID FK
    }
    BOOKING_HOLDS {
        number HOLD_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    BOOKING_HOLD_ITEMS {
        number HOLD_ITEM_ID PK
        number TENANT_ID FK
    }
    BOOKING_ITEMS {
        number BOOKING_ITEM_ID PK
        number TENANT_ID FK
    }
    BUSINESSES {
        number BUSINESS_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    BUSINESS_PROFILES {
        number BUSINESS_PROFILE_ID PK
        number TENANT_ID FK
    }
    BUSINESS_SPORTS {
        number TENANT_ID PK
        number BUSINESS_ID PK
        number SPORT_ID PK
    }
    CUSTOMERS {
        number CUSTOMER_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    HOLIDAYS {
        number HOLIDAY_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    LOCATIONS {
        number LOCATION_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    ONBOARDING_PROGRESS {
        number ONBOARDING_PROGRESS_ID PK
        number TENANT_ID FK
    }
    OPERATING_HOURS {
        number OPERATING_HOUR_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    PRICING_RULES {
        number PRICING_RULE_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    RESOURCES {
        number RESOURCE_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    RESOURCE_FEATURES {
        number RESOURCE_FEATURE_ID PK
        number TENANT_ID FK
    }
    RESOURCE_SLOT_RESERVATIONS {
        number TENANT_ID PK
        number RESOURCE_ID PK
        timestamp SLOT_START_UTC PK
    }
    SPORTS {
        number SPORT_ID PK
    }
    TENANTS {
        number TENANT_ID PK
        varchar2 PUBLIC_ID
    }
    TENANT_USERS {
        number MEMBERSHIP_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    WEBSITE_MEDIA {
        number WEBSITE_MEDIA_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    WEBSITE_SETTINGS {
        number WEBSITE_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    WEBSITE_THEMES {
        number THEME_ID PK
    }
```
