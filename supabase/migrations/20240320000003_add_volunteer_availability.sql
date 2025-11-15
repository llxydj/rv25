-- Add is_available column to volunteer_profiles table
ALTER TABLE volunteer_profiles
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT false;

-- Update existing rows to have is_available set to false
UPDATE volunteer_profiles
SET is_available = false
WHERE is_available IS NULL;

-- Create index for better query performance on availability checks
CREATE INDEX IF NOT EXISTS idx_volunteer_profiles_is_available 
ON volunteer_profiles(is_available);

-- Update RLS policies to include is_available field
DROP POLICY IF EXISTS "Volunteers can update own availability" ON volunteer_profiles;
CREATE POLICY "Volunteers can update own availability" ON volunteer_profiles
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