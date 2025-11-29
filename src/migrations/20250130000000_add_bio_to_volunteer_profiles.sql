-- Add bio field to volunteer_profiles table
-- This migration adds a bio/description field for volunteers to provide additional context about themselves

ALTER TABLE volunteer_profiles 
ADD COLUMN IF NOT EXISTS bio TEXT;

COMMENT ON COLUMN volunteer_profiles.bio IS 'Volunteer biography/description (max 1000 characters)';

-- Add check constraint to limit bio length
ALTER TABLE volunteer_profiles
ADD CONSTRAINT volunteer_profiles_bio_length_check 
CHECK (bio IS NULL OR LENGTH(bio) <= 1000);

