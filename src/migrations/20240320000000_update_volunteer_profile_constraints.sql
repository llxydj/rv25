-- Drop existing foreign key constraints if they exist
ALTER TABLE IF EXISTS volunteer_profiles 
  DROP CONSTRAINT IF EXISTS volunteer_profiles_volunteer_user_id_fkey,
  DROP CONSTRAINT IF EXISTS volunteer_profiles_admin_user_id_fkey;

-- Add new explicit foreign key constraints
ALTER TABLE volunteer_profiles
  ADD CONSTRAINT volunteer_profiles_volunteer_user_id_fkey 
    FOREIGN KEY (volunteer_user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE,
  ADD CONSTRAINT volunteer_profiles_admin_user_id_fkey 
    FOREIGN KEY (admin_user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL;

-- Add indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_volunteer_profiles_volunteer_user_id 
  ON volunteer_profiles(volunteer_user_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_profiles_admin_user_id 
  ON volunteer_profiles(admin_user_id);

-- Add a check constraint to ensure admin_user_id references a user with admin role
ALTER TABLE volunteer_profiles
  ADD CONSTRAINT volunteer_profiles_admin_role_check 
  CHECK (
    admin_user_id IS NULL OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = admin_user_id AND role = 'admin'
    )
  ); 