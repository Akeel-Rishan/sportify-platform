MERGE INTO PERMISSIONS p
USING (
    SELECT 'business.read' permission_code, 'View business' permission_name FROM dual UNION ALL
    SELECT 'business.manage', 'Manage business' FROM dual UNION ALL
    SELECT 'location.manage', 'Manage branches' FROM dual UNION ALL
    SELECT 'resource.manage', 'Manage facilities' FROM dual UNION ALL
    SELECT 'booking.read', 'View bookings' FROM dual UNION ALL
    SELECT 'booking.create', 'Create bookings' FROM dual UNION ALL
    SELECT 'booking.cancel', 'Cancel bookings' FROM dual UNION ALL
    SELECT 'payment.read', 'View payments' FROM dual UNION ALL
    SELECT 'payment.record', 'Record payments' FROM dual UNION ALL
    SELECT 'staff.manage', 'Manage staff' FROM dual UNION ALL
    SELECT 'report.read', 'View reports' FROM dual UNION ALL
    SELECT 'website.manage', 'Manage website' FROM dual UNION ALL
    SELECT 'subscription.read', 'View subscription' FROM dual UNION ALL
    SELECT 'subscription.manage', 'Manage subscription' FROM dual UNION ALL
    SELECT 'location.read', 'View branches' FROM dual UNION ALL
    SELECT 'resource.read', 'View facilities' FROM dual UNION ALL
    SELECT 'customer.read', 'View customers' FROM dual UNION ALL
    SELECT 'customer.manage', 'Manage customers' FROM dual UNION ALL
    SELECT 'booking.manage', 'Manage bookings' FROM dual UNION ALL
    SELECT 'payment.refund', 'Refund payments' FROM dual
) src
ON (p.PERMISSION_CODE = src.permission_code)
WHEN NOT MATCHED THEN INSERT (PERMISSION_CODE, PERMISSION_NAME)
VALUES (src.permission_code, src.permission_name)
