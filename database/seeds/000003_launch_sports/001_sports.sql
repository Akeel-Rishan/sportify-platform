MERGE INTO sports s
USING (
    SELECT 'FUTSAL' sport_code, 'Futsal' sport_name, 'Court' resource_label, 10 display_order FROM dual UNION ALL
    SELECT 'BADMINTON', 'Badminton', 'Court', 20 FROM dual UNION ALL
    SELECT 'INDOOR_CRICKET', 'Indoor Cricket', 'Net', 30 FROM dual UNION ALL
    SELECT 'BASKETBALL', 'Basketball', 'Court', 40 FROM dual UNION ALL
    SELECT 'VOLLEYBALL', 'Volleyball', 'Court', 50 FROM dual UNION ALL
    SELECT 'TENNIS', 'Tennis', 'Court', 60 FROM dual UNION ALL
    SELECT 'TABLE_TENNIS', 'Table Tennis', 'Table', 70 FROM dual UNION ALL
    SELECT 'SWIMMING', 'Swimming', 'Lane', 80 FROM dual
) src
ON (s.sport_code = src.sport_code)
WHEN NOT MATCHED THEN INSERT (sport_code, sport_name, resource_label, display_order, is_active)
VALUES (src.sport_code, src.sport_name, src.resource_label, src.display_order, 'Y')
