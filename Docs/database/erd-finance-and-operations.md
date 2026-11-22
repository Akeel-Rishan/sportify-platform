# Finance And Operations

Implementation overlay: this remains the **full proposed Step 05 design**, not an installed Step 07 schema. See [implemented SQL versus pending/Oracle-unverified structures](implemented-schema.md).

Proposed MVP logical diagram. Only included tables appear; shared parent context may repeat across diagrams. Exact columns/composite keys, optional checks and source deviations are in [relationships](relationships-and-constraints.md). Lines summarize multiple related FKs; nullable global scopes do not waive the non-null scope guard. Cardinality shown is schema capacity, not proof of required onboarding/item rows.

```mermaid
erDiagram
    direction LR
    TENANTS o|--o{ AUDIT_LOGS : global_or_root_FK
    USERS o|--o{ AUDIT_LOGS : global_or_root_FK
    TENANT_USERS o|--o{ AUDIT_LOGS : tenant_FK
    PLATFORM_ADMINS o|--o{ AUDIT_LOGS : global_or_root_FK
    BUSINESSES ||--o| BUSINESS_PAYMENT_SETTINGS : tenant_FK
    TENANTS ||--o{ IDEMPOTENCY_KEYS : global_or_root_FK
    TENANTS o|--o{ JOB_QUEUE : global_or_root_FK
    TENANTS o|--o{ NOTIFICATIONS : global_or_root_FK
    NOTIFICATION_TEMPLATES o|--o{ NOTIFICATIONS : global_or_root_FK
    BOOKINGS o|--o{ NOTIFICATIONS : tenant_FK
    USERS o|--o{ NOTIFICATIONS : global_or_root_FK
    NOTIFICATIONS ||--o{ NOTIFICATION_LOGS : tenant_FK
    TENANTS o|--o{ NOTIFICATION_LOGS : global_or_root_FK
    TENANTS o|--o{ OUTBOX_EVENTS : global_or_root_FK
    TENANT_USERS ||--o{ PAYMENTS : tenant_FK
    BOOKINGS ||--o{ PAYMENTS : tenant_FK
    TENANT_USERS ||--o{ REFUNDS : tenant_FK
    PAYMENTS ||--o{ REFUNDS : tenant_FK
    TENANTS ||--o{ SUBSCRIPTIONS : global_or_root_FK
    SUBSCRIPTION_PLANS ||--o{ SUBSCRIPTIONS : global_or_root_FK
    SUBSCRIPTION_PLANS ||--o{ SUBSCRIPTION_ENTITLEMENTS : global_or_root_FK
    SUBSCRIPTIONS ||--o{ SUBSCRIPTION_FEATURE_SNAPSHOTS : tenant_FK
    SUBSCRIPTIONS ||--o{ SUBSCRIPTION_INVOICES : tenant_FK
    USERS ||--o{ SUBSCRIPTION_PAYMENTS : global_or_root_FK
    SUBSCRIPTION_INVOICES ||--o{ SUBSCRIPTION_PAYMENTS : tenant_FK
    PLATFORM_ADMINS ||--o{ SUBSCRIPTION_PAYMENTS : global_or_root_FK
    AUDIT_LOGS {
        number AUDIT_LOG_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    BOOKINGS {
        number BOOKING_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    BUSINESSES {
        number BUSINESS_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    BUSINESS_PAYMENT_SETTINGS {
        number BUSINESS_PAYMENT_SETTINGS_ID PK
        number TENANT_ID FK
    }
    IDEMPOTENCY_KEYS {
        number IDEMPOTENCY_ID PK
        number TENANT_ID FK
    }
    JOB_QUEUE {
        number JOB_ID PK
        number TENANT_ID FK
    }
    NOTIFICATIONS {
        number NOTIFICATION_ID PK
        number TENANT_ID FK
    }
    NOTIFICATION_LOGS {
        number NOTIFICATION_LOG_ID PK
        number TENANT_ID FK
    }
    NOTIFICATION_TEMPLATES {
        number NOTIFICATION_TEMPLATE_ID PK
        number TENANT_ID FK
    }
    OUTBOX_EVENTS {
        number OUTBOX_EVENT_ID PK
        number TENANT_ID FK
    }
    PAYMENTS {
        number PAYMENT_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    PLATFORM_ADMINS {
        number PLATFORM_ADMIN_ID PK
    }
    PLATFORM_SETTINGS {
        varchar2 SETTING_KEY PK
    }
    REFUNDS {
        number REFUND_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    SUBSCRIPTIONS {
        number SUBSCRIPTION_ID PK
        number TENANT_ID FK
    }
    SUBSCRIPTION_ENTITLEMENTS {
        number PLAN_ID PK
        varchar2 FEATURE_CODE PK
    }
    SUBSCRIPTION_FEATURE_SNAPSHOTS {
        number TENANT_ID PK
        number SUBSCRIPTION_ID PK
        varchar2 FEATURE_CODE PK
    }
    SUBSCRIPTION_INVOICES {
        number SUBSCRIPTION_INVOICE_ID PK
        number TENANT_ID FK
    }
    SUBSCRIPTION_PAYMENTS {
        number SUBSCRIPTION_PAYMENT_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    SUBSCRIPTION_PLANS {
        number PLAN_ID PK
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
    USERS {
        number USER_ID PK
        varchar2 PUBLIC_ID
    }
```
