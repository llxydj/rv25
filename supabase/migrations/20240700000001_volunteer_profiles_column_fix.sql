-- This migration ensures that the volunteer_profiles table is properly updated to use
-- volunteer_user_id as the primary key instead of id column

-- First, let's check if the id column exists before using it
DO $$
BEGIN
    -- Check if id column exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'volunteer_profiles'
        AND column_name = 'id'
    ) THEN
        -- If id exists, align volunteer_user_id with id
        UPDATE volunteer_profiles
        SET volunteer_user_id = id
        WHERE volunteer_user_id IS NULL OR volunteer_user_id != id;
    END IF;
END $$;

-- First, drop constraints that might block our operations
ALTER TABLE volunteeractivities 
DROP CONSTRAINT IF EXISTS volunteeractivities_volunteer_user_id_fkey CASCADE,
DROP CONSTRAINT IF EXISTS fk_volunteeractivities_volunteer_user_id CASCADE;

ALTER TABLE scheduledactivities 
DROP CONSTRAINT IF EXISTS scheduledactivities_volunteer_user_id_fkey CASCADE,
DROP CONSTRAINT IF EXISTS fk_scheduledactivities_volunteer_user_id CASCADE;

-- Now we can safely drop constraints on volunteer_profiles
ALTER TABLE volunteer_profiles 
DROP CONSTRAINT IF EXISTS volunteer_profiles_user_id_fkey CASCADE,
DROP CONSTRAINT IF EXISTS volunteer_profiles_volunteer_user_id_fkey CASCADE,
DROP CONSTRAINT IF EXISTS volunteer_profiles_pkey CASCADE;

-- Make volunteer_user_id NOT NULL if it isn't already
ALTER TABLE volunteer_profiles 
ALTER COLUMN volunteer_user_id SET NOT NULL;

-- Make volunteer_user_id the primary key
DO $$
BEGIN
    -- Only try to drop id column if it exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'volunteer_profiles'
        AND column_name = 'id'
    ) THEN
        ALTER TABLE volunteer_profiles 
        DROP COLUMN IF EXISTS id CASCADE;
    END IF;
END $$;

-- Make sure volunteer_user_id is the primary key
ALTER TABLE volunteer_profiles
ADD PRIMARY KEY (volunteer_user_id);

-- Add the correct foreign key constraint
ALTER TABLE volunteer_profiles
ADD CONSTRAINT volunteer_profiles_volunteer_user_id_fkey 
FOREIGN KEY (volunteer_user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- Recreate the constraints on dependent tables
ALTER TABLE volunteeractivities
ADD CONSTRAINT fk_volunteeractivities_volunteer_user_id
FOREIGN KEY (volunteer_user_id) REFERENCES volunteer_profiles(volunteer_user_id)
ON DELETE CASCADE;

ALTER TABLE scheduledactivities
ADD CONSTRAINT fk_scheduledactivities_volunteer_user_id
FOREIGN KEY (volunteer_user_id) REFERENCES volunteer_profiles(volunteer_user_id)
ON DELETE CASCADE;

-- Update RLS policies to use the correct column
DROP POLICY IF EXISTS "Volunteers can view own profile" ON volunteer_profiles;
CREATE POLICY "Volunteers can view own profile" ON volunteer_profiles
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = volunteer_user_id OR
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Volunteers can update own profile" ON volunteer_profiles;
CREATE POLICY "Volunteers can update own profile" ON volunteer_profiles
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = volunteer_user_id OR
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    )
    WITH CHECK (
        auth.uid() = volunteer_user_id OR
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    ); 