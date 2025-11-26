-- Add missing indexes for better database performance

-- Index on volunteer_locations for faster location queries
CREATE INDEX IF NOT EXISTS idx_volunteer_locations_user_id 
ON volunteer_locations (user_id);

CREATE INDEX IF NOT EXISTS idx_volunteer_locations_created_at 
ON volunteer_locations (created_at);

CREATE INDEX IF NOT EXISTS idx_volunteer_locations_lat_lng 
ON volunteer_locations (lat, lng);

-- Index on incidents for faster status queries
CREATE INDEX IF NOT EXISTS idx_incidents_status 
ON incidents (status);

CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to 
ON incidents (assigned_to);

CREATE INDEX IF NOT EXISTS idx_incidents_reporter_id 
ON incidents (reporter_id);

CREATE INDEX IF NOT EXISTS idx_incidents_created_at 
ON incidents (created_at);

-- Index on users for faster role queries
CREATE INDEX IF NOT EXISTS idx_users_role 
ON users (role);

CREATE INDEX IF NOT EXISTS idx_users_status 
ON users (status);

-- Index on volunteer_profiles for faster availability queries
CREATE INDEX IF NOT EXISTS idx_volunteer_profiles_is_available 
ON volunteer_profiles (is_available);

CREATE INDEX IF NOT EXISTS idx_volunteer_profiles_status 
ON volunteer_profiles (status);

-- Index on notifications for faster user queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
ON notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_read_at 
ON notifications (read_at);

-- Index on reports for faster status queries
CREATE INDEX IF NOT EXISTS idx_reports_status 
ON reports (status);

CREATE INDEX IF NOT EXISTS idx_reports_created_by 
ON reports (created_by);

-- Index on sms_logs for faster incident queries
CREATE INDEX IF NOT EXISTS idx_sms_logs_incident_id 
ON sms_logs (incident_id);

-- Index on sms_logs for faster delivery status queries
CREATE INDEX IF NOT EXISTS idx_sms_logs_delivery_status 
ON sms_logs (delivery_status);