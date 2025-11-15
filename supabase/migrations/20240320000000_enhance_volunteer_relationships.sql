-- Step 0: Verify data before changes
DO $$ 
BEGIN 
  -- Check for any volunteer profiles that might be orphaned
  IF EXISTS (
    SELECT 1 FROM volunteer_profiles vp 
    LEFT JOIN users u ON vp.id = u.id 
    WHERE u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Found orphaned volunteer profiles. Please fix data integrity before migration.';
  END IF;

  -- Check for any invalid admin references
  IF EXISTS (
    SELECT 1 FROM volunteer_profiles vp 
    LEFT JOIN users u ON vp.created_by = u.id 
    WHERE vp.created_by IS NOT NULL AND u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Found invalid admin references. Please fix data integrity before migration.';
  END IF;
END $$;

-- Step 1: Temporarily disable foreign key checks and RLS
ALTER TABLE volunteer_profiles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing foreign key constraints (save the data)
ALTER TABLE volunteer_profiles 
  DROP CONSTRAINT IF EXISTS volunteer_profiles_id_fkey,
  DROP CONSTRAINT IF EXISTS volunteer_profiles_created_by_fkey;

-- Step 3: Rename columns to be more explicit
ALTER TABLE volunteer_profiles
  RENAME COLUMN id TO volunteer_user_id,
  RENAME COLUMN created_by TO admin_user_id;

-- Step 4: Add new explicit foreign key constraints with clear names
ALTER TABLE volunteer_profiles
  ADD CONSTRAINT volunteer_profiles_volunteer_user_id_fkey 
    FOREIGN KEY (volunteer_user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE,
  ADD CONSTRAINT volunteer_profiles_admin_user_id_fkey 
    FOREIGN KEY (admin_user_id) 
    REFERENCES users(id);

-- Step 5: Update primary key
ALTER TABLE volunteer_profiles 
  DROP CONSTRAINT volunteer_profiles_pkey,
  ADD CONSTRAINT volunteer_profiles_pkey 
    PRIMARY KEY (volunteer_user_id);

-- Step 6: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_volunteer_profiles_admin_user_id 
  ON volunteer_profiles(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_profiles_status 
  ON volunteer_profiles(status);

-- Step 7: Add audit trail columns for future extensibility
ALTER TABLE volunteer_profiles
  ADD COLUMN IF NOT EXISTS last_status_change TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_status_changed_by UUID REFERENCES users(id);

-- Step 8: Create a trigger to track status changes
CREATE OR REPLACE FUNCTION track_volunteer_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.last_status_change := CURRENT_TIMESTAMP;
    NEW.last_status_changed_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_volunteer_status_change
  BEFORE UPDATE ON volunteer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION track_volunteer_status_changes();

-- Step 9: Re-enable RLS
ALTER TABLE volunteer_profiles ENABLE ROW LEVEL SECURITY;

-- Step 10: Update RLS policies with new column names
DROP POLICY IF EXISTS "Volunteers can view own profile" ON volunteer_profiles;
CREATE POLICY "Volunteers can view own profile" ON volunteer_profiles
  FOR SELECT USING (auth.uid() = volunteer_user_id);

DROP POLICY IF EXISTS "Admins can view all volunteer profiles" ON volunteer_profiles;
CREATE POLICY "Admins can view all volunteer profiles" ON volunteer_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Step 11: Add a comment to the table for documentation
COMMENT ON TABLE volunteer_profiles IS 'Stores volunteer-specific information with explicit relationships to users table. volunteer_user_id references the volunteer''s user account, while admin_user_id references the admin who created the profile.';

-- Final Step: Verify data after changes
DO $$ 
BEGIN
  -- Verify all volunteer profiles have valid user references
  IF EXISTS (
    SELECT 1 FROM volunteer_profiles vp 
    LEFT JOIN users u ON vp.volunteer_user_id = u.id 
    WHERE u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Data integrity check failed after migration: invalid volunteer references';
  END IF;

  -- Verify all admin references are valid
  IF EXISTS (
    SELECT 1 FROM volunteer_profiles vp 
    LEFT JOIN users u ON vp.admin_user_id = u.id 
    WHERE vp.admin_user_id IS NOT NULL AND u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Data integrity check failed after migration: invalid admin references';
  END IF;

  -- Verify no duplicate volunteer profiles
  IF EXISTS (
    SELECT volunteer_user_id 
    FROM volunteer_profiles 
    GROUP BY volunteer_user_id 
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Data integrity check failed after migration: duplicate volunteer profiles found';
  END IF;
END $$; 