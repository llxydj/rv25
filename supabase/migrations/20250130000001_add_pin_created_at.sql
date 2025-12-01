-- Add pin_created_at column to track when PIN was set (for 15-day validity)
-- This migration adds a timestamp field to track PIN creation date

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS pin_created_at TIMESTAMP WITH TIME ZONE;

-- Update existing users with PIN to set pin_created_at to updated_at or created_at
-- This ensures existing PINs have a creation date
UPDATE public.users
SET pin_created_at = COALESCE(updated_at, created_at)
WHERE pin_hash IS NOT NULL AND pin_created_at IS NULL;

-- Add comment
COMMENT ON COLUMN public.users.pin_created_at IS 'Timestamp when PIN was created. PIN expires after 15 days from this date.';

