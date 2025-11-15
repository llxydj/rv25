-- Add missing RLS policies for volunteer_profiles table

-- Allow volunteers to insert their own profile
CREATE POLICY "Volunteers can create own profile" ON volunteer_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = volunteer_user_id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Allow volunteers to update their own profile
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
  );

-- Ensure the default RLS policy for SELECT exists
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