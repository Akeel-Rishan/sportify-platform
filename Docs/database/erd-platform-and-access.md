# Platform And Access

Implementation overlay: this remains the **full proposed Step 05 design**, not an installed Step 07 schema. See [implemented SQL versus pending/Oracle-unverified structures](implemented-schema.md).

Proposed MVP logical diagram. Only included tables appear; shared parent context may repeat across diagrams. Exact columns/composite keys, optional checks and source deviations are in [relationships](relationships-and-constraints.md). Lines summarize multiple related FKs; nullable global scopes do not waive the non-null scope guard. Cardinality shown is schema capacity, not proof of required onboarding/item rows.

```mermaid
erDiagram
    direction LR
    USERS ||--o{ AUTH_SESSIONS : global_or_root_FK
    TENANT_USERS o|--o{ AUTH_SESSIONS : global_or_root_FK
    USERS ||--o{ EMAIL_VERIFICATION_TOKENS : global_or_root_FK
    TENANT_INVITATIONS ||--o{ INVITATION_LOCATIONS : tenant_FK
    LOCATIONS ||--o{ INVITATION_LOCATIONS : tenant_FK
    USERS ||--o{ PASSWORD_RESET_TOKENS : global_or_root_FK
    USERS ||--o| PLATFORM_ADMINS : global_or_root_FK
    TENANTS ||--o{ ROLES : global_or_root_FK
    ROLES ||--o{ ROLE_PERMISSIONS : tenant_FK
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : global_or_root_FK
    TENANT_USERS ||--o{ STAFF_ASSIGNMENTS : tenant_FK
    LOCATIONS ||--o{ STAFF_ASSIGNMENTS : tenant_FK
    TENANTS ||--o{ TENANT_INVITATIONS : global_or_root_FK
    ROLES ||--o{ TENANT_INVITATIONS : tenant_FK
    TENANT_USERS ||--o{ TENANT_INVITATIONS : tenant_FK
    TENANTS ||--o{ TENANT_USERS : global_or_root_FK
    USERS ||--o{ TENANT_USERS : global_or_root_FK
    TENANT_USERS ||--o{ USER_ROLES : tenant_FK
    ROLES ||--o{ USER_ROLES : tenant_FK
    AUTH_SESSIONS {
        number SESSION_ID PK
    }
    EMAIL_VERIFICATION_TOKENS {
        number VERIFICATION_ID PK
        varchar2 PUBLIC_ID
    }
    INVITATION_LOCATIONS {
        number TENANT_ID PK
        number INVITATION_ID PK
        number LOCATION_ID PK
    }
    LOCATIONS {
        number LOCATION_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    PASSWORD_RESET_TOKENS {
        number RESET_ID PK
        varchar2 PUBLIC_ID
    }
    PERMISSIONS {
        number PERMISSION_ID PK
    }
    PLATFORM_ADMINS {
        number PLATFORM_ADMIN_ID PK
    }
    ROLES {
        number ROLE_ID PK
        number TENANT_ID FK
    }
    ROLE_PERMISSIONS {
        number TENANT_ID PK
        number ROLE_ID PK
        number PERMISSION_ID PK
    }
    SCHEMA_MIGRATIONS {
        varchar2 VERSION PK
    }
    STAFF_ASSIGNMENTS {
        number STAFF_ASSIGNMENT_ID PK
        number TENANT_ID FK
        varchar2 PUBLIC_ID
    }
    TENANTS {
        number TENANT_ID PK
        varchar2 PUBLIC_ID
    }
    TENANT_INVITATIONS {
        number INVITATION_ID PK
        number TENANT_ID FK
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
    USER_ROLES {
        number TENANT_ID PK
        number MEMBERSHIP_ID PK
        number ROLE_ID PK
    }
```
