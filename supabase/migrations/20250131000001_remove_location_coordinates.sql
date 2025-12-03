-- Remove location coordinates from trainings, schedules, and announcements tables
-- This migration removes the location_lat and location_lng columns that are no longer used
-- Migration is idempotent and can be safely retried

DO $$
BEGIN
  -- Drop indexes first (they depend on the columns)
  DROP INDEX IF EXISTS public.idx_trainings_location;
  DROP INDEX IF EXISTS public.idx_schedules_location;
  DROP INDEX IF EXISTS public.idx_announcements_location;

  -- Remove location coordinates from trainings table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'trainings' 
    AND column_name = 'location_lat'
  ) THEN
    ALTER TABLE public.trainings DROP COLUMN location_lat;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'trainings' 
    AND column_name = 'location_lng'
  ) THEN
    ALTER TABLE public.trainings DROP COLUMN location_lng;
  END IF;

  -- Remove location coordinates from schedules table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'schedules' 
    AND column_name = 'location_lat'
  ) THEN
    ALTER TABLE public.schedules DROP COLUMN location_lat;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'schedules' 
    AND column_name = 'location_lng'
  ) THEN
    ALTER TABLE public.schedules DROP COLUMN location_lng;
  END IF;

  -- Remove location coordinates from announcements table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'announcements' 
    AND column_name = 'location_lat'
  ) THEN
    ALTER TABLE public.announcements DROP COLUMN location_lat;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'announcements' 
    AND column_name = 'location_lng'
  ) THEN
    ALTER TABLE public.announcements DROP COLUMN location_lng;
  END IF;
END $$;

-- Remove column comments (idempotent)
COMMENT ON COLUMN public.trainings.location_lat IS NULL;
COMMENT ON COLUMN public.trainings.location_lng IS NULL;
COMMENT ON COLUMN public.schedules.location_lat IS NULL;
COMMENT ON COLUMN public.schedules.location_lng IS NULL;
COMMENT ON COLUMN public.announcements.location_lat IS NULL;
COMMENT ON COLUMN public.announcements.location_lng IS NULL;

