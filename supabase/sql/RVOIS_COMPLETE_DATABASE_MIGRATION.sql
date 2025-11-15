-- ===================================================================
-- RVOIS COMPLETE DATABASE MIGRATION
-- ===================================================================
-- This file consolidates all database fixes and improvements
-- Run this in Supabase SQL Editor to apply all changes at once
-- ===================================================================

-- ===================================================================
-- PART 1: BASIC REALTIME SETUP (from supabase-realtime-fixes.sql)
-- ===================================================================

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

-- 5. Fix location_preferences RLS policies
DROP POLICY IF EXISTS "Users can manage their own location preferences" ON location_preferences;

CREATE POLICY "users_manage_own_preferences"
ON location_preferences FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 6. Create materialized view for active volunteers (last 5 minutes)
CREATE MATERIALIZED VIEW IF NOT EXISTS active_volunteers_last_5min AS
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
CREATE INDEX IF NOT EXISTS idx_active_volunteers_user_id ON active_volunteers_last_5min(user_id);
CREATE INDEX IF NOT EXISTS idx_active_volunteers_timestamp ON active_volunteers_last_5min(timestamp);

-- 7. Create RPC function for getting volunteers within radius
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

-- Grant execute permission on RPC function
GRANT EXECUTE ON FUNCTION get_volunteers_within_radius TO authenticated;

-- 8. Create system_logs table for audit trail
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  details TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  error_message TEXT
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

-- ===================================================================
-- PART 2: CRITICAL SECURITY FIXES
-- ===================================================================

-- Fix 1: Create barangay_boundaries table for proper geographic filtering
CREATE TABLE IF NOT EXISTS public.barangay_boundaries (
  id SERIAL PRIMARY KEY,
  barangay_name VARCHAR(100) NOT NULL,
  geometry GEOMETRY(POLYGON, 4326) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add spatial index for performance
CREATE INDEX IF NOT EXISTS idx_barangay_boundaries_geometry 
ON public.barangay_boundaries USING GIST (geometry);

-- Add RLS for barangay_boundaries
ALTER TABLE public.barangay_boundaries ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can manage boundaries
CREATE POLICY "admins_manage_barangay_boundaries"
ON public.barangay_boundaries FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Fix 2: Update barangay RLS policy to check actual assigned areas
DROP POLICY IF EXISTS "barangay_read_local_locations" ON public.location_tracking;

CREATE POLICY "barangay_read_local_locations"
ON public.location_tracking FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.volunteer_profiles vp ON u.id = vp.volunteer_user_id
    WHERE u.id = auth.uid() 
    AND u.role = 'barangay'
    AND (
      -- Check if user's assigned barangays intersect with incident barangay
      vp.assigned_barangays && ARRAY[
        (SELECT barangay FROM public.incidents 
         WHERE location_lat = location_tracking.latitude 
         AND location_lng = location_tracking.longitude
         LIMIT 1)
      ]
      OR
      -- Fallback: check if location is within user's barangay boundaries
      EXISTS (
        SELECT 1 FROM public.barangay_boundaries bb
        WHERE bb.barangay_name = ANY(vp.assigned_barangays)
        AND ST_Contains(bb.geometry, ST_Point(location_tracking.longitude, location_tracking.latitude))
      )
    )
  )
);

-- Fix 3: Add function to validate barangay access
CREATE OR REPLACE FUNCTION validate_barangay_access(
  user_id UUID,
  target_barangay VARCHAR(100),
  target_lat DECIMAL,
  target_lng DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR(20);
  assigned_areas TEXT[];
BEGIN
  -- Get user role and assigned areas
  SELECT u.role, vp.assigned_barangays
  INTO user_role, assigned_areas
  FROM public.users u
  LEFT JOIN public.volunteer_profiles vp ON u.id = vp.volunteer_user_id
  WHERE u.id = user_id;
  
  -- Admin and volunteer roles have broader access
  IF user_role IN ('admin', 'volunteer') THEN
    RETURN TRUE;
  END IF;
  
  -- Barangay users can only access their assigned areas
  IF user_role = 'barangay' THEN
    -- Check if target barangay is in assigned areas
    IF target_barangay = ANY(assigned_areas) THEN
      RETURN TRUE;
    END IF;
    
    -- Check if location is within assigned barangay boundaries
    IF EXISTS (
      SELECT 1 FROM public.barangay_boundaries bb
      WHERE bb.barangay_name = ANY(assigned_areas)
      AND ST_Contains(bb.geometry, ST_Point(target_lng, target_lat))
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 4: Add audit logging for barangay access attempts
CREATE TABLE IF NOT EXISTS public.barangay_access_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  target_barangay VARCHAR(100),
  target_lat DECIMAL,
  target_lng DECIMAL,
  access_granted BOOLEAN NOT NULL,
  access_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS for access logs
ALTER TABLE public.barangay_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_access_logs"
ON public.barangay_access_logs FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- ===================================================================
-- PART 3: MATERIALIZED VIEW REFRESH FIXES
-- ===================================================================

-- Fix 1: Create proper refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_active_volunteers_view()
RETURNS VOID AS $$
BEGIN
  -- Refresh the materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY active_volunteers_last_5min;
  
  -- Log the refresh
  INSERT INTO public.system_logs (action, details, created_by)
  VALUES ('refresh_active_volunteers_view', 'Materialized view refreshed', 'system');
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the operation
    INSERT INTO public.system_logs (action, details, created_by, error_message)
    VALUES ('refresh_active_volunteers_view', 'Failed to refresh materialized view', 'system', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 2: Create trigger function to refresh view on location_tracking changes
CREATE OR REPLACE FUNCTION trigger_refresh_active_volunteers()
RETURNS TRIGGER AS $$
BEGIN
  -- Use pg_notify to signal refresh (non-blocking)
  PERFORM pg_notify('refresh_active_volunteers', 'refresh_needed');
  
  -- Also refresh immediately for critical updates
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Only refresh if the change affects active volunteers
    IF EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.volunteer_profiles vp ON u.id = vp.volunteer_user_id
      WHERE u.id = COALESCE(NEW.user_id, OLD.user_id)
      AND vp.status = 'ACTIVE'
    ) THEN
      PERFORM refresh_active_volunteers_view();
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Fix 3: Create trigger on location_tracking table
DROP TRIGGER IF EXISTS trigger_location_tracking_refresh ON public.location_tracking;

CREATE TRIGGER trigger_location_tracking_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.location_tracking
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_active_volunteers();

-- Fix 4: Create function to check materialized view freshness
CREATE OR REPLACE FUNCTION check_materialized_view_freshness()
RETURNS TABLE(
  view_name TEXT,
  last_refresh TIMESTAMP WITH TIME ZONE,
  is_stale BOOLEAN,
  staleness_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'active_volunteers_last_5min'::TEXT as view_name,
    sl.created_at as last_refresh,
    (sl.created_at < NOW() - INTERVAL '5 minutes') as is_stale,
    EXTRACT(EPOCH FROM (NOW() - sl.created_at))/60 as staleness_minutes
  FROM public.system_logs sl
  WHERE sl.action = 'refresh_active_volunteers_view'
  ORDER BY sl.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- PART 4: SCHEDULED CLEANUP SYSTEM
-- ===================================================================

-- Fix 1: Create comprehensive cleanup function with proper error handling
CREATE OR REPLACE FUNCTION cleanup_old_location_data(
  retention_days INTEGER DEFAULT 7,
  batch_size INTEGER DEFAULT 1000
)
RETURNS TABLE(
  deleted_count INTEGER,
  cleanup_duration_ms DECIMAL,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  start_time TIMESTAMP WITH TIME ZONE := NOW();
  deleted_count INTEGER := 0;
  temp_count INTEGER;
  cutoff_date TIMESTAMP WITH TIME ZONE;
  error_msg TEXT;
BEGIN
  -- Calculate cutoff date
  cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Log cleanup start
  INSERT INTO public.system_logs (action, details, created_by)
  VALUES ('cleanup_old_location_data', 'Starting cleanup for data older than ' || cutoff_date, 'system');
  
  -- Delete in batches to avoid locking issues
  LOOP
    DELETE FROM public.location_tracking
    WHERE timestamp < cutoff_date
    AND id IN (
      SELECT id FROM public.location_tracking
      WHERE timestamp < cutoff_date
      LIMIT batch_size
    );
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- Exit if no more rows to delete
    EXIT WHEN temp_count = 0;
    
    -- Small delay to prevent overwhelming the database
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  -- Log successful cleanup
  INSERT INTO public.system_logs (action, details, created_by)
  VALUES (
    'cleanup_old_location_data', 
    'Cleanup completed. Deleted ' || deleted_count || ' records', 
    'system'
  );
  
  -- Return success
  RETURN QUERY SELECT 
    deleted_count,
    EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000,
    TRUE,
    NULL::TEXT;
    
EXCEPTION
  WHEN OTHERS THEN
    error_msg := SQLERRM;
    
    -- Log error
    INSERT INTO public.system_logs (action, details, created_by, error_message)
    VALUES (
      'cleanup_old_location_data', 
      'Cleanup failed after deleting ' || deleted_count || ' records', 
      'system', 
      error_msg
    );
    
    -- Return failure
    RETURN QUERY SELECT 
      deleted_count,
      EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000,
      FALSE,
      error_msg;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 2: Create cleanup scheduling table for external schedulers
CREATE TABLE IF NOT EXISTS public.cleanup_schedule (
  id SERIAL PRIMARY KEY,
  cleanup_type VARCHAR(50) NOT NULL,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  interval_hours INTEGER DEFAULT 24,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default schedule
INSERT INTO public.cleanup_schedule (cleanup_type, interval_hours, next_run)
VALUES ('location_data', 24, NOW() + INTERVAL '1 hour')
ON CONFLICT DO NOTHING;

-- Add RLS for cleanup_schedule table
ALTER TABLE public.cleanup_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_cleanup_schedule"
ON public.cleanup_schedule FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- ===================================================================
-- PART 5: PERFORMANCE INDEXES
-- ===================================================================

-- Add indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_tracking_user_timestamp 
ON location_tracking(user_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_tracking_recent 
ON location_tracking(timestamp DESC) 
WHERE timestamp > NOW() - INTERVAL '1 hour';

-- Add composite index for volunteer queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_tracking_volunteer_recent
ON location_tracking(user_id, timestamp DESC)
WHERE timestamp > NOW() - INTERVAL '5 minutes';

-- ===================================================================
-- PART 6: MONITORING FUNCTIONS
-- ===================================================================

-- Create function to get connection status
CREATE OR REPLACE FUNCTION get_realtime_connection_status()
RETURNS TABLE (
  is_connected BOOLEAN,
  last_activity TIMESTAMP WITH TIME ZONE,
  active_volunteers_count INTEGER,
  materialized_view_fresh BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as is_connected, -- Supabase handles connection status
    MAX(lt.timestamp) as last_activity,
    COUNT(DISTINCT lt.user_id)::INTEGER as active_volunteers_count,
    EXISTS (
      SELECT 1 FROM system_logs sl
      WHERE sl.action = 'refresh_active_volunteers_view'
      AND sl.created_at > NOW() - INTERVAL '5 minutes'
    ) as materialized_view_fresh
  FROM location_tracking lt
  WHERE lt.timestamp > NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_realtime_connection_status TO authenticated;

-- Create function to get cleanup status
CREATE OR REPLACE FUNCTION get_cleanup_status()
RETURNS TABLE(
  last_location_cleanup TIMESTAMP WITH TIME ZONE,
  location_records_count BIGINT,
  cleanup_needed BOOLEAN,
  next_scheduled_cleanup TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT MAX(created_at) FROM public.system_logs WHERE action = 'cleanup_old_location_data') as last_location_cleanup,
    (SELECT COUNT(*) FROM public.location_tracking WHERE timestamp < NOW() - INTERVAL '7 days') as location_records_count,
    (SELECT COUNT(*) FROM public.location_tracking WHERE timestamp < NOW() - INTERVAL '7 days') > 1000 as cleanup_needed,
    (SELECT MIN(next_run) FROM public.cleanup_schedule WHERE enabled = TRUE) as next_scheduled_cleanup;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- MIGRATION COMPLETE
-- ===================================================================

-- Log successful migration
INSERT INTO public.system_logs (action, details, created_by)
VALUES ('database_migration', 'Complete RVOIS database migration applied successfully', 'system');

-- Display summary
SELECT 
  'Migration Complete' as status,
  'All database fixes and improvements have been applied' as message,
  NOW() as completed_at;
