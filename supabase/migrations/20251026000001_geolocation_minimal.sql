-- Minimal Geolocation Migration - For Testing
-- This creates ONLY the critical components to diagnose issues

BEGIN;

-- Drop old location_tracking table if exists
DROP TABLE IF EXISTS public.location_tracking CASCADE;

-- Create geofence_boundaries table (critical for boundary validation)
DROP TABLE IF EXISTS public.geofence_boundaries CASCADE;

CREATE TABLE public.geofence_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  boundary_type TEXT NOT NULL CHECK (boundary_type IN ('city', 'barangay', 'zone', 'radius')),
  geometry JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert Talisay City boundary data
INSERT INTO public.geofence_boundaries (name, boundary_type, geometry, metadata) VALUES
(
  'Talisay City',
  'city',
  jsonb_build_object(
    'type', 'rectangle',
    'bounds', jsonb_build_array(
      jsonb_build_array(10.6, 122.8),
      jsonb_build_array(10.8, 123.0)
    ),
    'center', jsonb_build_array(10.7, 122.9)
  ),
  jsonb_build_object(
    'province', 'Negros Occidental',
    'country', 'Philippines',
    'timezone', 'Asia/Manila'
  )
);

-- Enable RLS and create policies
ALTER TABLE public.geofence_boundaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY geofence_boundaries_read ON public.geofence_boundaries
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY geofence_boundaries_admin_manage ON public.geofence_boundaries
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Create the critical RPC function
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
    SELECT DISTINCT ON (vl.user_id)
      vl.user_id,
      vl.lat AS latitude,
      vl.lng AS longitude,
      vl.accuracy,
      vl.speed,
      vl.heading,
      vl.created_at AS last_seen,
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
    WHERE vl.created_at > NOW() - INTERVAL '30 minutes'
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

GRANT EXECUTE ON FUNCTION get_volunteers_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

COMMENT ON FUNCTION get_volunteers_within_radius IS 'Returns volunteers within a specified radius with their latest location';
COMMENT ON TABLE public.geofence_boundaries IS 'Geographic boundaries for geofencing';

COMMIT;

-- Test the setup
SELECT 'Migration completed successfully!' AS status;
SELECT COUNT(*) AS boundary_count FROM public.geofence_boundaries;
