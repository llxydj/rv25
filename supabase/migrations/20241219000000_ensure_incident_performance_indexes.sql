-- Ensure critical indexes exist for incident reporting performance optimization
-- This migration verifies and creates any missing indexes identified in performance audit

-- Index on users.role (critical for admin queries during incident creation)
-- Used in: SELECT * FROM users WHERE role = 'admin'
CREATE INDEX IF NOT EXISTS idx_users_role 
ON users (role);

-- Index on push_subscriptions.user_id (critical for notification queries)
-- Used in: SELECT * FROM push_subscriptions WHERE user_id IN (...)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
ON push_subscriptions (user_id);

-- Composite index on users for role + phone_number queries (optimizes admin SMS queries)
-- Used in: SELECT id, phone_number FROM users WHERE role = 'admin' AND phone_number IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_users_role_phone 
ON users (role) 
WHERE phone_number IS NOT NULL;

-- Composite index on push_subscriptions for user_id + subscription lookups
-- Used in: SELECT subscription, user_id, endpoint FROM push_subscriptions WHERE user_id IN (...)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_endpoint 
ON push_subscriptions (user_id, endpoint);

-- Index on incidents.barangay (for barangay-based queries)
CREATE INDEX IF NOT EXISTS idx_incidents_barangay 
ON incidents (barangay);

-- Index on incidents.incident_type (for filtering by type)
CREATE INDEX IF NOT EXISTS idx_incidents_incident_type 
ON incidents (incident_type);

-- Composite index on incidents for status + priority queries (common in admin dashboards)
CREATE INDEX IF NOT EXISTS idx_incidents_status_priority 
ON incidents (status, priority);

-- Add comments for documentation
COMMENT ON INDEX idx_users_role IS 'Optimizes admin user lookups during incident creation';
COMMENT ON INDEX idx_push_subscriptions_user_id IS 'Optimizes push subscription queries for notifications';
COMMENT ON INDEX idx_users_role_phone IS 'Optimizes admin phone number queries for SMS alerts';
COMMENT ON INDEX idx_push_subscriptions_user_endpoint IS 'Optimizes push subscription endpoint lookups';
COMMENT ON INDEX idx_incidents_barangay IS 'Optimizes barangay-based incident filtering';
COMMENT ON INDEX idx_incidents_incident_type IS 'Optimizes incident type filtering';
COMMENT ON INDEX idx_incidents_status_priority IS 'Optimizes status and priority filtering in dashboards';

