-- Add is_within_talisay_city Pre-calculated Column
-- This improves query performance by avoiding function calls in WHERE clauses

BEGIN;

-- =====================================================
-- 1. ADD BOOLEAN COLUMN
-- =====================================================

ALTER TABLE public.volunteer_locations
ADD COLUMN IF NOT EXISTS is_within_talisay_city BOOLEAN DEFAULT NULL;

-- Create index for fast filtering
CREATE INDEX IF NOT EXISTS idx_volunteer_locations_within_city
  ON public.volunteer_locations(is_within_talisay_city)
  WHERE is_within_talisay_city = TRUE;

COMMENT ON COLUMN public.volunteer_locations.is_within_talisay_city 
IS 'Pre-calculated boolean indicating if location is within Talisay City boundaries';


-- =====================================================
-- 2. CREATE TRIGGER FUNCTION TO AUTO-CALCULATE
-- =====================================================

CREATE OR REPLACE FUNCTION set_is_within_talisay_city()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Automatically calculate and set the boolean using the existing function
  NEW.is_within_talisay_city := is_within_talisay_city(NEW.lat, NEW.lng);
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_set_is_within_talisay_city ON public.volunteer_locations;

-- Create trigger that runs BEFORE INSERT OR UPDATE
CREATE TRIGGER trigger_set_is_within_talisay_city
  BEFORE INSERT OR UPDATE OF lat, lng
  ON public.volunteer_locations
  FOR EACH ROW
  EXECUTE FUNCTION set_is_within_talisay_city();

COMMENT ON FUNCTION set_is_within_talisay_city() 
IS 'Trigger function to automatically set is_within_talisay_city boolean on insert/update';


-- =====================================================
-- 3. BACKFILL EXISTING DATA
-- =====================================================

-- Update all existing records to calculate their geofence status
UPDATE public.volunteer_locations
SET is_within_talisay_city = is_within_talisay_city(lat, lng)
WHERE is_within_talisay_city IS NULL;

-- Analyze table to update statistics for query planner
ANALYZE public.volunteer_locations;

COMMIT;

-- Verify the update
SELECT 
  COUNT(*) AS total_locations,
  COUNT(*) FILTER (WHERE is_within_talisay_city = TRUE) AS within_city,
  COUNT(*) FILTER (WHERE is_within_talisay_city = FALSE) AS outside_city,
  COUNT(*) FILTER (WHERE is_within_talisay_city IS NULL) AS uncalculated
FROM public.volunteer_locations;
