-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can view all volunteer profiles" ON volunteer_profiles;

-- Create a more permissive policy for admins to view all users
CREATE POLICY "Admins have full access to users" ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Create a more permissive policy for admins to access volunteer profiles
CREATE POLICY "Admins have full access to volunteer profiles" ON volunteer_profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Ensure public access is disabled
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE volunteer_profiles FORCE ROW LEVEL SECURITY;

-- Add default deny policies
CREATE POLICY "Default deny for users" ON users
  FOR ALL
  TO public
  USING (false);

CREATE POLICY "Default deny for volunteer profiles" ON volunteer_profiles
  FOR ALL
  TO public
  USING (false); 