-- Fix Barangay RLS Security Loophole
-- Current issue: Only checks role, not actual assigned areas
-- This creates a major security vulnerability

-- First, let's check the current RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('location_tracking', 'location_preferences', 'incidents');

-- Fix 1: Update barangay RLS policy for location_tracking to check actual assigned areas
DROP POLICY IF EXISTS "barangay_read_local_locations" ON public.location_tracking;

-- Create proper barangay RLS policy that checks assigned barangays
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

-- Fix 2: Update incidents RLS policy for barangay users
DROP POLICY IF EXISTS "barangay_read_local_incidents" ON public.incidents;

CREATE POLICY "barangay_read_local_incidents"
ON public.incidents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.volunteer_profiles vp ON u.id = vp.volunteer_user_id
    WHERE u.id = auth.uid() 
    AND u.role = 'barangay'
    AND (
      -- Check if incident barangay matches user's assigned barangays
      incidents.barangay = ANY(vp.assigned_barangays)
      OR
      -- Check if incident location is within user's barangay boundaries
      EXISTS (
        SELECT 1 FROM public.barangay_boundaries bb
        WHERE bb.barangay_name = ANY(vp.assigned_barangays)
        AND ST_Contains(bb.geometry, ST_Point(incidents.location_lng, incidents.location_lat))
      )
    )
  )
);

-- Fix 3: Create barangay_boundaries table for proper geographic filtering
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

-- Fix 4: Update volunteer_profiles to ensure assigned_barangays is properly populated
-- Add constraint to ensure assigned_barangays is not empty for barangay users
ALTER TABLE public.volunteer_profiles 
ADD CONSTRAINT check_barangay_users_have_assigned_areas 
CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = volunteer_user_id 
    AND u.role = 'barangay' 
    AND (assigned_barangays IS NULL OR array_length(assigned_barangays, 1) = 0)
  )
);

-- Fix 5: Add function to validate barangay access
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

-- Fix 6: Update existing RLS policies to use the validation function
DROP POLICY IF EXISTS "barangay_read_local_locations" ON public.location_tracking;

CREATE POLICY "barangay_read_local_locations"
ON public.location_tracking FOR SELECT
TO authenticated
USING (
  validate_barangay_access(
    auth.uid(),
    (SELECT barangay FROM public.incidents 
     WHERE location_lat = location_tracking.latitude 
     AND location_lng = location_tracking.longitude
     LIMIT 1),
    location_tracking.latitude,
    location_tracking.longitude
  )
);

-- Fix 7: Add audit logging for barangay access attempts
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

-- Fix 8: Update the validation function to include audit logging
CREATE OR REPLACE FUNCTION validate_barangay_access(
  user_id UUID,
  target_barangay VARCHAR(100),
  target_lat DECIMAL,
  target_lng DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR(20);
  assigned_areas TEXT[];
  access_granted BOOLEAN := FALSE;
  access_reason TEXT;
BEGIN
  -- Get user role and assigned areas
  SELECT u.role, vp.assigned_barangays
  INTO user_role, assigned_areas
  FROM public.users u
  LEFT JOIN public.volunteer_profiles vp ON u.id = vp.volunteer_user_id
  WHERE u.id = user_id;
  
  -- Admin and volunteer roles have broader access
  IF user_role IN ('admin', 'volunteer') THEN
    access_granted := TRUE;
    access_reason := 'Admin/Volunteer role access';
  END IF;
  
  -- Barangay users can only access their assigned areas
  IF user_role = 'barangay' AND NOT access_granted THEN
    -- Check if target barangay is in assigned areas
    IF target_barangay = ANY(assigned_areas) THEN
      access_granted := TRUE;
      access_reason := 'Barangay name match';
    END IF;
    
    -- Check if location is within assigned barangay boundaries
    IF NOT access_granted AND EXISTS (
      SELECT 1 FROM public.barangay_boundaries bb
      WHERE bb.barangay_name = ANY(assigned_areas)
      AND ST_Contains(bb.geometry, ST_Point(target_lng, target_lat))
    ) THEN
      access_granted := TRUE;
      access_reason := 'Geographic boundary match';
    END IF;
  END IF;
  
  -- Log the access attempt
  INSERT INTO public.barangay_access_logs (
    user_id, target_barangay, target_lat, target_lng, 
    access_granted, access_reason
  ) VALUES (
    user_id, target_barangay, target_lat, target_lng,
    access_granted, access_reason
  );
  
  RETURN access_granted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 9: Add function to populate barangay boundaries (admin only)
CREATE OR REPLACE FUNCTION populate_barangay_boundaries()
RETURNS VOID AS $$
BEGIN
  -- This function should be called by admins to populate barangay boundaries
  -- For now, we'll create a placeholder that can be updated with real data
  
  -- Example: Insert basic boundaries for Talisay City barangays
  -- In production, this should be populated with actual GeoJSON data
  
  INSERT INTO public.barangay_boundaries (barangay_name, geometry) VALUES
  ('Barangay 1', ST_GeomFromText('POLYGON((122.8 10.6, 122.9 10.6, 122.9 10.7, 122.8 10.7, 122.8 10.6))', 4326)),
  ('Barangay 2', ST_GeomFromText('POLYGON((122.9 10.6, 123.0 10.6, 123.0 10.7, 122.9 10.7, 122.9 10.6))', 4326))
  ON CONFLICT DO NOTHING;
  
  -- Log the population
  INSERT INTO public.system_logs (action, details, created_by)
  VALUES ('populate_barangay_boundaries', 'Barangay boundaries populated', 'system');
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 10: Add trigger to automatically update barangay_access_logs
CREATE OR REPLACE FUNCTION log_barangay_access()
RETURNS TRIGGER AS $$
BEGIN
  -- This trigger will be called when accessing location data
  -- The actual logging is handled in the validate_barangay_access function
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Summary of fixes:
-- 1. Fixed barangay RLS to check actual assigned areas, not just roles
-- 2. Added barangay_boundaries table for geographic filtering
-- 3. Created validation function with audit logging
-- 4. Added constraints to ensure barangay users have assigned areas
-- 5. Added comprehensive access logging for security monitoring
