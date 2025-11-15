-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all volunteers" ON users;
DROP POLICY IF EXISTS "Admins can view all volunteer profiles" ON volunteer_profiles;

-- Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view all users
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create policy for admins to view all volunteer profiles
CREATE POLICY "Admins can view all volunteer profiles" ON volunteer_profiles
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

-- Create policy for admins to update volunteer profiles
CREATE POLICY "Admins can update volunteer profiles" ON volunteer_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create policy for volunteers to view their own profile
CREATE POLICY "Volunteers can view own profile" ON volunteer_profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = volunteer_user_id
  );

-- Create policy for volunteers to update their own profile
CREATE POLICY "Volunteers can update own profile" ON volunteer_profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = volunteer_user_id
  )
  WITH CHECK (
    auth.uid() = volunteer_user_id
  ); 