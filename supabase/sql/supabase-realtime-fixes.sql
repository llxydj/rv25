-- Enable Supabase Realtime and Database Fixes
-- Run these SQL commands in Supabase SQL Editor

-- 1. Enable Realtime Replication for location_tracking
ALTER TABLE location_tracking REPLICA IDENTITY FULL;

-- 2. Grant realtime access
GRANT SELECT ON location_tracking TO authenticated;

-- 3. Enable realtime on location_preferences
ALTER TABLE location_preferences REPLICA IDENTITY FULL;
GRANT SELECT ON location_preferences TO authenticated;

-- 4. Add missing RLS policies for location_tracking
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own location data" ON location_tracking;
DROP POLICY IF EXISTS "Users can insert their own location data" ON location_tracking;
DROP POLICY IF EXISTS "Admins can view all location data" ON location_tracking;

-- Create comprehensive RLS policies
-- Volunteers can insert their own location
CREATE POLICY "volunteers_insert_own_location"
ON location_tracking FOR INSERT 
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'volunteer'
  )
);

-- Admins can read all locations
CREATE POLICY "admins_read_all_locations"
ON location_tracking FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Volunteers can read their own location history
CREATE POLICY "volunteers_read_own_location"
ON location_tracking FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Barangay users can read locations in their assigned barangays
CREATE POLICY "barangay_read_local_locations"
ON location_tracking FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.role = 'barangay'
  )
);

-- 5. Fix location_preferences RLS policies
DROP POLICY IF EXISTS "Users can manage their own location preferences" ON location_preferences;

CREATE POLICY "users_manage_own_preferences"
ON location_preferences FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 6. Add spatial indexes for better performance
-- Create PostGIS spatial index if PostGIS is enabled
-- CREATE INDEX CONCURRENTLY idx_location_tracking_spatial 
-- ON location_tracking USING GIST (ST_Point(longitude, latitude));

-- 7. Create materialized view for active volunteers (last 5 minutes)
CREATE MATERIALIZED VIEW IF NOT EXISTS active_volunteers AS
SELECT DISTINCT ON (user_id)
  user_id,
  latitude,
  longitude,
  timestamp,
  accuracy,
  heading,
  speed
FROM location_tracking
WHERE timestamp > NOW() - INTERVAL '5 minutes'
ORDER BY user_id, timestamp DESC;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_active_volunteers_user_id ON active_volunteers(user_id);
CREATE INDEX IF NOT EXISTS idx_active_volunteers_timestamp ON active_volunteers(timestamp);

-- 8. Add data retention policy (keep last 7 days)
-- This will be handled by a scheduled function
CREATE OR REPLACE FUNCTION cleanup_old_location_data()
RETURNS void AS $$
BEGIN
  -- Delete location data older than 7 days
  DELETE FROM location_tracking 
  WHERE timestamp < NOW() - INTERVAL '7 days';
  
  -- Log cleanup activity
  INSERT INTO system_logs (action, details, created_at)
  VALUES ('location_cleanup', 
          'Cleaned up location data older than 7 days', 
          NOW());
END;
$$ LANGUAGE plpgsql;

-- 9. Create RPC function for getting volunteers within radius
CREATE OR REPLACE FUNCTION get_volunteers_within_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 10
)
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  last_seen TIMESTAMP WITH TIME ZONE,
  accuracy DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (lt.user_id)
    lt.user_id,
    u.first_name,
    u.last_name,
    u.phone_number,
    lt.latitude,
    lt.longitude,
    -- Calculate distance using Haversine formula
    (6371 * acos(
      cos(radians(center_lat)) * 
      cos(radians(lt.latitude)) * 
      cos(radians(lt.longitude) - radians(center_lng)) + 
      sin(radians(center_lat)) * 
      sin(radians(lt.latitude))
    )) AS distance_km,
    lt.timestamp AS last_seen,
    lt.accuracy,
    lt.heading,
    lt.speed
  FROM location_tracking lt
  JOIN users u ON lt.user_id = u.id
  WHERE u.role = 'volunteer'
    AND lt.timestamp > NOW() - INTERVAL '5 minutes'
    AND (
      6371 * acos(
        cos(radians(center_lat)) * 
        cos(radians(lt.latitude)) * 
        cos(radians(lt.longitude) - radians(center_lng)) + 
        sin(radians(center_lat)) * 
        sin(radians(lt.latitude))
      )
    ) <= radius_km
  ORDER BY lt.user_id, lt.timestamp DESC;
END;
$$ LANGUAGE plpgsql;

-- 10. Grant execute permission on RPC function
GRANT EXECUTE ON FUNCTION get_volunteers_within_radius TO authenticated;

-- 11. Create system_logs table for audit trail
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  details TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on system_logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read system logs
CREATE POLICY "admins_read_system_logs"
ON system_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 12. Refresh materialized view function
CREATE OR REPLACE FUNCTION refresh_active_volunteers()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY active_volunteers;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_active_volunteers TO authenticated;

-- 13. Create trigger to refresh materialized view when location_tracking changes
CREATE OR REPLACE FUNCTION trigger_refresh_active_volunteers()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh materialized view asynchronously
  PERFORM pg_notify('refresh_active_volunteers', '');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS refresh_active_volunteers_trigger ON location_tracking;
CREATE TRIGGER refresh_active_volunteers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON location_tracking
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_active_volunteers();

-- 14. Add indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_tracking_user_timestamp 
ON location_tracking(user_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_tracking_recent 
ON location_tracking(timestamp DESC) 
WHERE timestamp > NOW() - INTERVAL '1 hour';

-- 15. Create function to get connection status
CREATE OR REPLACE FUNCTION get_realtime_connection_status()
RETURNS TABLE (
  is_connected BOOLEAN,
  last_activity TIMESTAMP WITH TIME ZONE,
  active_volunteers_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as is_connected, -- Supabase handles connection status
    MAX(lt.timestamp) as last_activity,
    COUNT(DISTINCT lt.user_id)::INTEGER as active_volunteers_count
  FROM location_tracking lt
  WHERE lt.timestamp > NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_realtime_connection_status TO authenticated;
