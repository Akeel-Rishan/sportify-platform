ALTER TABLE AUTH_SESSIONS ADD CONSTRAINT CK_AUTH_SESSION_IDLE
CHECK (idle_expires_at_utc IS NULL OR (idle_expires_at_utc>created_at_utc AND idle_expires_at_utc<=expires_at_utc))
