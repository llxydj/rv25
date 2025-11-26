-- Ensure is_available column exists and has correct default
ALTER TABLE volunteer_profiles
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT false;

-- Update existing rows to have is_available set to false if NULL
UPDATE volunteer_profiles
SET is_available = false
WHERE is_available IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_volunteer_profiles_is_available 
ON volunteer_profiles(is_available);

-- Update RLS policies to handle is_available
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

-- Ensure proper foreign key relationships for incidents
ALTER TABLE incidents
DROP CONSTRAINT IF EXISTS incidents_reporter_id_fkey,
ADD CONSTRAINT incidents_reporter_id_fkey
  FOREIGN KEY (reporter_id)
  REFERENCES users(id)
  ON DELETE SET NULL;

ALTER TABLE incidents
DROP CONSTRAINT IF EXISTS incidents_assigned_to_fkey,
ADD CONSTRAINT incidents_assigned_to_fkey
  FOREIGN KEY (assigned_to)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_incidents_reporter_id
ON incidents(reporter_id);

CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to
ON incidents(assigned_to);

-- Update RLS policies for incidents
DROP POLICY IF EXISTS "Users can view their own incidents" ON incidents;
CREATE POLICY "Users can view their own incidents" ON incidents
  FOR SELECT
  TO authenticated
  USING (
    reporter_id = auth.uid() OR
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  ); 