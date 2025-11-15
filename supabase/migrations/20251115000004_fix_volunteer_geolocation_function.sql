-- Fix and improve the volunteer geolocation function
-- This function finds volunteers within a specified radius

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_volunteers_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

-- Create the improved RPC function
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
  -- Validate inputs
  IF center_lat IS NULL OR center_lng IS NULL OR radius_km IS NULL THEN
    RETURN;
  END IF;
  
  -- Ensure radius is positive
  IF radius_km <= 0 THEN
    radius_km := 10;
  END IF;
  
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
          greatest(
            -1.0,
            least(
              1.0,
              cos(radians(center_lat)) * 
              cos(radians(vl.lat)) * 
              cos(radians(vl.lng) - radians(center_lng)) + 
              sin(radians(center_lat)) * 
              sin(radians(vl.lat))
            )
          )
        )
      ) AS distance_km
    FROM public.volunteer_locations vl
    WHERE vl.created_at > NOW() - INTERVAL '30 minutes'
      AND vl.lat IS NOT NULL 
      AND vl.lng IS NOT NULL
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
    AND u.status = 'active'
  ORDER BY ll.distance_km ASC;
EXCEPTION WHEN OTHERS THEN
  -- Return empty result set on any error
  RETURN QUERY SELECT 
    NULL::UUID,
    NULL::DOUBLE PRECISION,
    NULL::DOUBLE PRECISION,
    NULL::DOUBLE PRECISION,
    NULL::DOUBLE PRECISION,
    NULL::DOUBLE PRECISION,
    NULL::TIMESTAMP WITH TIME ZONE,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::DOUBLE PRECISION,
    NULL::BOOLEAN,
    NULL::TEXT[],
    NULL::TEXT[];
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_volunteers_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION get_volunteers_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION get_volunteers_within_radius IS 'Returns volunteers within a specified radius with their latest location. Returns empty set on error.';