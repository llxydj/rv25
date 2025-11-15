-- First, drop any existing foreign key constraints to clean up
ALTER TABLE volunteer_profiles 
DROP CONSTRAINT IF EXISTS volunteer_profiles_user_id_fkey,
DROP CONSTRAINT IF EXISTS volunteer_profiles_volunteer_user_id_fkey,
DROP CONSTRAINT IF EXISTS volunteer_profiles_pkey;

-- Drop any duplicate columns if they exist
ALTER TABLE volunteer_profiles 
DROP COLUMN IF EXISTS user_id;

-- Ensure volunteer_user_id exists and is NOT NULL
ALTER TABLE volunteer_profiles 
ADD COLUMN IF NOT EXISTS volunteer_user_id UUID;

-- Update the volunteer_user_id column with the id value if it's NULL
UPDATE volunteer_profiles
SET volunteer_user_id = id
WHERE volunteer_user_id IS NULL;

-- Make volunteer_user_id NOT NULL
ALTER TABLE volunteer_profiles 
ALTER COLUMN volunteer_user_id SET NOT NULL;

-- Remove the id as primary key and add a new primary key on volunteer_user_id
ALTER TABLE volunteer_profiles 
DROP CONSTRAINT IF EXISTS volunteer_profiles_pkey;

ALTER TABLE volunteer_profiles
ADD PRIMARY KEY (volunteer_user_id);

-- Add the correct foreign key constraint
ALTER TABLE volunteer_profiles
ADD CONSTRAINT volunteer_profiles_volunteer_user_id_fkey 
FOREIGN KEY (volunteer_user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_volunteer_profiles_volunteer_user_id 
ON volunteer_profiles(volunteer_user_id);

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