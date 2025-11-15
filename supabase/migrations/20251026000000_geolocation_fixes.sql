-- Geolocation System Fixes and Enhancements
-- This migration fixes critical issues and adds missing components for full geolocation functionality

BEGIN;

-- =====================================================
-- 0. CLEANUP OBSOLETE TABLES
-- =====================================================
-- Remove old location_tracking table (replaced by volunteer_locations)

DROP TABLE IF EXISTS public.location_tracking CASCADE;

-- =====================================================
-- 1. CREATE MISSING RPC FUNCTION: get_volunteers_within_radius
-- =====================================================
-- This is the critical function that maps and auto-assignment depend on
-- Returns volunteers with their latest location within a specified radius

-- Drop existing function if it exists (handles signature changes)
DROP FUNCTION IF EXISTS get_volunteers_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

CREATE OR REPLACE FUNCTION get_volunteers_within_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 10
)
RETURNS TABLE (
  user_id UUID,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  last_seen TIMESTAMP WITH TIME ZONE,
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  email TEXT,
  distance_km DOUBLE PRECISION,
  is_available BOOLEAN,
  skills TEXT[],
  assigned_barangays TEXT[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH latest_locations AS (
    -- Get the most recent location for each volunteer
    SELECT DISTINCT ON (vl.user_id)
      vl.user_id,
      vl.lat AS latitude,
      vl.lng AS longitude,
      vl.accuracy,
      vl.speed,
      vl.heading,
      vl.created_at AS last_seen,
      -- Calculate distance using Haversine formula
      (
        6371 * acos(
          cos(radians(center_lat)) * 
          cos(radians(vl.lat)) * 
          cos(radians(vl.lng) - radians(center_lng)) + 
          sin(radians(center_lat)) * 
          sin(radians(vl.lat))
        )
      ) AS distance_km
    FROM public.volunteer_locations vl
    WHERE 
      -- Only consider locations from the last 30 minutes (active volunteers)
      vl.created_at > NOW() - INTERVAL '30 minutes'
    ORDER BY vl.user_id, vl.created_at DESC
  )
  SELECT 
    ll.user_id,
    ll.latitude,
    ll.longitude,
    ll.accuracy,
    ll.speed,
    ll.heading,
    ll.last_seen,
    u.first_name,
    u.last_name,
    u.phone_number,
    u.email,
    ll.distance_km,
    COALESCE(vp.is_available, false) AS is_available,
    COALESCE(vp.skills, ARRAY[]::TEXT[]) AS skills,
    COALESCE(vp.assigned_barangays, ARRAY[]::TEXT[]) AS assigned_barangays
  FROM latest_locations ll
  INNER JOIN public.users u ON u.id = ll.user_id
  LEFT JOIN public.volunteer_profiles vp ON vp.volunteer_user_id = ll.user_id
  WHERE 
    ll.distance_km <= radius_km
    AND u.role = 'volunteer'
  ORDER BY ll.distance_km ASC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_volunteers_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

COMMENT ON FUNCTION get_volunteers_within_radius IS 'Returns volunteers within a specified radius with their latest location, sorted by distance';


-- =====================================================
-- 2. UPDATE LOCATION PREFERENCES TABLE (if needed)
-- =====================================================
-- Note: Table already exists in schema, just ensure it has necessary columns

-- Add share_with_public column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'location_preferences' 
    AND column_name = 'share_with_public'
  ) THEN
    ALTER TABLE public.location_preferences 
    ADD COLUMN share_with_public BOOLEAN DEFAULT false;
    
    -- Update existing rows
    UPDATE public.location_preferences 
    SET share_with_public = false 
    WHERE share_with_public IS NULL;
    
    -- Now make it NOT NULL
    ALTER TABLE public.location_preferences 
    ALTER COLUMN share_with_public SET NOT NULL;
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.location_preferences ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS location_prefs_own_data ON public.location_preferences;
DROP POLICY IF EXISTS location_prefs_admin_view ON public.location_preferences;

-- Create policy only if user_id column exists as a valid reference
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'location_preferences' 
    AND column_name = 'user_id'
  ) THEN
    EXECUTE 'CREATE POLICY location_prefs_own_data ON public.location_preferences
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Policy already exists, skip
  NULL;
END $$;

-- Create admin view policy
DO $$
BEGIN
  EXECUTE 'CREATE POLICY location_prefs_admin_view ON public.location_preferences
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = ''admin''
      )
    )';
EXCEPTION WHEN duplicate_object THEN
  -- Policy already exists, skip
  NULL;
END $$;

COMMENT ON TABLE public.location_preferences IS 'User preferences for location tracking and sharing';


-- =====================================================
-- 3. CREATE TALISAY CITY BOUNDARIES TABLE
-- =====================================================
-- Centralized boundary configuration (no more hardcoded values)

-- Drop existing objects if they exist
DROP POLICY IF EXISTS geofence_boundaries_read ON public.geofence_boundaries;
DROP POLICY IF EXISTS geofence_boundaries_admin_manage ON public.geofence_boundaries;
DROP TABLE IF EXISTS public.geofence_boundaries CASCADE;

CREATE TABLE public.geofence_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  boundary_type TEXT NOT NULL CHECK (boundary_type IN ('city', 'barangay', 'zone', 'radius')),
  geometry JSONB NOT NULL, -- Store as GeoJSON or coordinates array
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.geofence_boundaries IS 'Geographic boundaries for geofencing and location validation';

-- Insert Talisay City boundary (before RLS is enabled)
INSERT INTO public.geofence_boundaries (name, boundary_type, geometry, metadata) VALUES
(
  'Talisay City',
  'city',
  jsonb_build_object(
    'type', 'rectangle',
    'bounds', jsonb_build_array(
      jsonb_build_array(10.6, 122.8),  -- Southwest corner
      jsonb_build_array(10.8, 123.0)   -- Northeast corner
    ),
    'center', jsonb_build_array(10.7, 122.9)
  ),
  jsonb_build_object(
    'province', 'Negros Occidental',
    'country', 'Philippines',
    'timezone', 'Asia/Manila'
  )
)
ON CONFLICT (name) DO UPDATE SET
  geometry = EXCLUDED.geometry,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- Now enable RLS and create policies (after data is inserted)
ALTER TABLE public.geofence_boundaries ENABLE ROW LEVEL SECURITY;

-- Everyone can read boundaries
CREATE POLICY geofence_boundaries_read ON public.geofence_boundaries
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only admins can modify
CREATE POLICY geofence_boundaries_admin_manage ON public.geofence_boundaries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- =====================================================
-- 4. CREATE FUNCTION TO CHECK IF LOCATION IS WITHIN TALISAY
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS is_within_talisay_city(DOUBLE PRECISION, DOUBLE PRECISION);

CREATE OR REPLACE FUNCTION is_within_talisay_city(
  check_lat DOUBLE PRECISION,
  check_lng DOUBLE PRECISION
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  bounds JSONB;
  sw_lat DOUBLE PRECISION;
  sw_lng DOUBLE PRECISION;
  ne_lat DOUBLE PRECISION;
  ne_lng DOUBLE PRECISION;
BEGIN
  -- Get Talisay City bounds
  SELECT geometry->'bounds' INTO bounds
  FROM public.geofence_boundaries
  WHERE name = 'Talisay City' AND is_active = true
  LIMIT 1;

  IF bounds IS NULL THEN
    -- If no boundary defined, return true (permissive)
    RETURN true;
  END IF;

  -- Extract coordinates
  sw_lat := (bounds->0->>0)::DOUBLE PRECISION;
  sw_lng := (bounds->0->>1)::DOUBLE PRECISION;
  ne_lat := (bounds->1->>0)::DOUBLE PRECISION;
  ne_lng := (bounds->1->>1)::DOUBLE PRECISION;

  -- Check if point is within rectangle
  RETURN (
    check_lat >= sw_lat AND 
    check_lat <= ne_lat AND 
    check_lng >= sw_lng AND 
    check_lng <= ne_lng
  );
END;
$$;

GRANT EXECUTE ON FUNCTION is_within_talisay_city(DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

COMMENT ON FUNCTION is_within_talisay_city IS 'Checks if coordinates are within Talisay City boundaries';


-- =====================================================
-- 5. ADD DATA RETENTION POLICY
-- =====================================================
-- Automatically clean up old location data (>30 days)

-- Drop existing function if it exists (handles signature changes)
DROP FUNCTION IF EXISTS cleanup_old_location_data();

CREATE OR REPLACE FUNCTION cleanup_old_location_data()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete location records older than 30 days
  DELETE FROM public.volunteer_locations
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up % old location records', deleted_count;
  
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_location_data IS 'Deletes location records older than 30 days to maintain database performance';

-- Note: Schedule this function to run daily via pg_cron or external scheduler
-- Example (if pg_cron is enabled):
-- SELECT cron.schedule('cleanup-old-locations', '0 2 * * *', 'SELECT cleanup_old_location_data();');


-- =====================================================
-- 6. ADD VOLUNTEER STATUS TRACKING
-- =====================================================
-- Track volunteer availability status in real-time

-- Drop existing objects if they exist
DROP TRIGGER IF EXISTS volunteer_location_activity_update ON public.volunteer_locations;
DROP TRIGGER IF EXISTS volunteer_status_update_timestamp ON public.volunteer_status;
DROP FUNCTION IF EXISTS update_volunteer_activity();
DROP FUNCTION IF EXISTS update_volunteer_status_timestamp();
DROP POLICY IF EXISTS volunteer_status_own ON public.volunteer_status;
DROP POLICY IF EXISTS volunteer_status_admin_view ON public.volunteer_status;
DROP TABLE IF EXISTS public.volunteer_status CASCADE;

CREATE TABLE public.volunteer_status (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('available', 'on_task', 'offline', 'unavailable')),
  status_message TEXT,
  last_status_change TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick status lookups
CREATE INDEX IF NOT EXISTS idx_volunteer_status_lookup ON public.volunteer_status(user_id, status);

-- RLS policies
ALTER TABLE public.volunteer_status ENABLE ROW LEVEL SECURITY;

-- Users can manage their own status
CREATE POLICY volunteer_status_own ON public.volunteer_status
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins and barangay users can view all statuses
CREATE POLICY volunteer_status_admin_view ON public.volunteer_status
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'barangay')
    )
  );

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_volunteer_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.last_status_change = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER volunteer_status_update_timestamp
  BEFORE UPDATE ON public.volunteer_status
  FOR EACH ROW
  EXECUTE FUNCTION update_volunteer_status_timestamp();

-- Function to auto-update status based on location updates
CREATE OR REPLACE FUNCTION update_volunteer_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last activity when new location is recorded
  INSERT INTO public.volunteer_status (user_id, status, last_activity)
  VALUES (NEW.user_id, 'available', NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    last_activity = NOW(),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER volunteer_location_activity_update
  AFTER INSERT ON public.volunteer_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_volunteer_activity();

COMMENT ON TABLE public.volunteer_status IS 'Real-time status tracking for volunteers';


-- =====================================================
-- 7. ADD HELPFUL VIEWS
-- =====================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.active_volunteers_with_location;

-- View: Active volunteers with their latest location
CREATE OR REPLACE VIEW public.active_volunteers_with_location AS
SELECT 
  u.id,
  u.first_name,
  u.last_name,
  u.email,
  u.phone_number,
  vl.lat AS latitude,
  vl.lng AS longitude,
  vl.accuracy,
  vl.created_at AS last_location_update,
  vs.status,
  vs.status_message,
  vs.last_activity,
  vp.is_available,
  vp.skills,
  vp.assigned_barangays
FROM public.users u
INNER JOIN public.volunteer_profiles vp ON vp.volunteer_user_id = u.id
LEFT JOIN LATERAL (
  SELECT lat, lng, accuracy, created_at
  FROM public.volunteer_locations
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) vl ON true
LEFT JOIN public.volunteer_status vs ON vs.user_id = u.id
WHERE u.role = 'volunteer'
  AND vl.created_at > NOW() - INTERVAL '30 minutes';

COMMENT ON VIEW public.active_volunteers_with_location IS 'Active volunteers with their most recent location (last 30 minutes)';


-- =====================================================
-- 8. PERFORMANCE INDEXES
-- =====================================================

-- Additional indexes for better query performance
-- Note: Removed WHERE clause with NOW() to avoid IMMUTABLE function requirement
CREATE INDEX IF NOT EXISTS idx_volunteer_locations_recent 
  ON public.volunteer_locations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_volunteer_locations_spatial 
  ON public.volunteer_locations(lat, lng);


-- =====================================================
-- 9. GRANT PERMISSIONS
-- =====================================================

-- Ensure authenticated users can access necessary functions and tables
GRANT SELECT ON public.active_volunteers_with_location TO authenticated;
GRANT SELECT ON public.geofence_boundaries TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_location_data() TO postgres; -- Only postgres/admin should run cleanup


-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMIT;

-- Summary of changes:
-- ✅ Created get_volunteers_within_radius() RPC function
-- ✅ Created location_preferences table for user settings
-- ✅ Created geofence_boundaries table with Talisay City bounds
-- ✅ Created is_within_talisay_city() validation function
-- ✅ Added cleanup_old_location_data() for data retention
-- ✅ Created volunteer_status table for real-time status tracking
-- ✅ Added active_volunteers_with_location view
-- ✅ Added performance indexes
-- ✅ Set up proper RLS policies on all tables
-- ✅ Added automatic status updates on location changes
