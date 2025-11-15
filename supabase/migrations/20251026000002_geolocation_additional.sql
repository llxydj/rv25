-- Additional Geolocation Components
-- Adds volunteer status tracking, helper functions, and views

BEGIN;

-- =====================================================
-- 1. ADD BOUNDARY CHECK FUNCTION
-- =====================================================

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
-- 2. CREATE VOLUNTEER REAL-TIME STATUS TABLE
-- =====================================================
-- Note: Named 'volunteer_real_time_status' to avoid conflict with existing 'volunteer_status' enum type

DROP TABLE IF EXISTS public.volunteer_real_time_status CASCADE;

CREATE TABLE public.volunteer_real_time_status (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('available', 'on_task', 'offline', 'unavailable')),
  status_message TEXT,
  last_status_change TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volunteer_realtime_status_lookup ON public.volunteer_real_time_status(user_id, status);

-- Enable RLS
ALTER TABLE public.volunteer_real_time_status ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY volunteer_realtime_status_own ON public.volunteer_real_time_status
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY volunteer_realtime_status_admin_view ON public.volunteer_real_time_status
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'barangay')));

COMMENT ON TABLE public.volunteer_real_time_status IS 'Real-time status tracking for volunteers (online/offline/on_task)';


-- =====================================================
-- 3. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to update volunteer status timestamp
DROP FUNCTION IF EXISTS update_volunteer_status_timestamp() CASCADE;

CREATE OR REPLACE FUNCTION update_volunteer_realtime_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.last_status_change = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER volunteer_realtime_status_update_timestamp
  BEFORE UPDATE ON public.volunteer_real_time_status
  FOR EACH ROW
  EXECUTE FUNCTION update_volunteer_realtime_status_timestamp();

-- Function to auto-update status based on location
DROP FUNCTION IF EXISTS update_volunteer_activity() CASCADE;

CREATE OR REPLACE FUNCTION update_volunteer_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.volunteer_real_time_status (user_id, status, last_activity)
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

-- Data cleanup function
DROP FUNCTION IF EXISTS cleanup_old_location_data() CASCADE;

CREATE OR REPLACE FUNCTION cleanup_old_location_data()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.volunteer_locations
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Cleaned up % old location records', deleted_count;
  
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_location_data IS 'Deletes location records older than 30 days';


-- =====================================================
-- 4. CREATE HELPFUL VIEW
-- =====================================================

DROP VIEW IF EXISTS public.active_volunteers_with_location;

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
  vs.status AS realtime_status,
  vs.status_message,
  vs.last_activity,
  COALESCE(vp.is_available, false) AS is_available,
  COALESCE(vp.skills, ARRAY[]::text[]) AS skills,
  COALESCE(vp.assigned_barangays, ARRAY[]::text[]) AS assigned_barangays
FROM public.users u
LEFT JOIN public.volunteer_profiles vp ON vp.volunteer_user_id = u.id
LEFT JOIN LATERAL (
  SELECT lat, lng, accuracy, created_at
  FROM public.volunteer_locations
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) vl ON true
LEFT JOIN public.volunteer_real_time_status vs ON vs.user_id = u.id
WHERE u.role = 'volunteer'
  AND vl.created_at > NOW() - INTERVAL '30 minutes';

GRANT SELECT ON public.active_volunteers_with_location TO authenticated;

COMMENT ON VIEW public.active_volunteers_with_location IS 'Active volunteers with recent location (last 30 minutes)';


-- =====================================================
-- 5. ADD PERFORMANCE INDEXES
-- =====================================================

-- Note: Removed WHERE clause with NOW() to avoid IMMUTABLE function requirement
CREATE INDEX IF NOT EXISTS idx_volunteer_locations_recent 
  ON public.volunteer_locations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_volunteer_locations_spatial 
  ON public.volunteer_locations(lat, lng);


-- =====================================================
-- 6. UPDATE LOCATION PREFERENCES (if needed)
-- =====================================================

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
  END IF;
END $$;

COMMIT;

-- Verify setup
SELECT 'Additional components installed successfully!' AS status;
SELECT COUNT(*) AS volunteer_realtime_status_exists 
FROM information_schema.tables 
WHERE table_name = 'volunteer_real_time_status';
