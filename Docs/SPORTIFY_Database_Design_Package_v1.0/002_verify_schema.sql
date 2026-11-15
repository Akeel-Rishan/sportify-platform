-- SPORTIFY schema verification queries
-- Run after 001_sportify_schema.sql completes successfully.
-- Read-only checks; does not modify schema or data.

PROMPT === SPORTIFY schema version ===
SELECT version, description, installed_at_utc, installed_by
FROM schema_migrations
ORDER BY installed_at_utc DESC;

PROMPT === Table count (expected: 61) ===
SELECT COUNT(*) AS table_count
FROM user_tables;

PROMPT === Invalid schema objects (expected: no rows) ===
SELECT object_type, object_name, status
FROM user_objects
WHERE status = 'INVALID'
ORDER BY object_type, object_name;

PROMPT === Disabled or not-validated constraints (expected: no rows) ===
SELECT table_name, constraint_name, constraint_type, status, validated
FROM user_constraints
WHERE status <> 'ENABLED'
   OR validated <> 'VALIDATED'
ORDER BY table_name, constraint_name;

PROMPT === Constraint totals by type ===
SELECT constraint_type, COUNT(*) AS constraint_count
FROM user_constraints
GROUP BY constraint_type
ORDER BY constraint_type;

PROMPT === Index totals and status ===
SELECT status, COUNT(*) AS index_count
FROM user_indexes
GROUP BY status
ORDER BY status;

PROMPT === Initial sports seed data ===
SELECT sport_code, sport_name, resource_label, is_active
FROM sports
ORDER BY display_order, sport_code;

PROMPT === Default website theme ===
SELECT theme_code, theme_name, is_active
FROM website_themes
ORDER BY theme_code;

PROMPT === Initial permission catalog ===
SELECT permission_code, permission_name
FROM permissions
ORDER BY permission_code;

PROMPT === Booking slot primary key ===
SELECT constraint_name, table_name, constraint_type, status
FROM user_constraints
WHERE table_name = 'RESOURCE_SLOT_RESERVATIONS'
  AND constraint_type = 'P';

PROMPT === Tenant-aware foreign keys ===
SELECT table_name, constraint_name, r_constraint_name, status
FROM user_constraints
WHERE constraint_type = 'R'
  AND table_name IN (
    'TENANT_USERS','ROLES','ROLE_PERMISSIONS','USER_ROLES','STAFF_ASSIGNMENTS',
    'BUSINESSES','BUSINESS_PROFILES','LOCATIONS','BUSINESS_SPORTS','RESOURCES',
    'RESOURCE_FEATURES','OPERATING_HOURS','HOLIDAYS','AVAILABILITY_BLOCKS',
    'PRICING_RULES','CUSTOMERS','BOOKING_HOLDS','BOOKING_HOLD_ITEMS','BOOKINGS',
    'BOOKING_ITEMS','RESOURCE_SLOT_RESERVATIONS','PAYMENTS','REFUNDS',
    'SUBSCRIPTIONS','SUBSCRIPTION_INVOICES','SUBSCRIPTION_PAYMENTS',
    'WEBSITE_SETTINGS','WEBSITE_MEDIA','DOMAINS','DOMAIN_VERIFICATIONS',
    'NOTIFICATIONS','NOTIFICATION_LOGS','SUPPORT_TICKETS','MARKETPLACE_LISTINGS',
    'REVIEWS','REVIEW_RESPONSES','ONBOARDING_PROGRESS'
  )
ORDER BY table_name, constraint_name;

PROMPT === End of SPORTIFY verification ===
