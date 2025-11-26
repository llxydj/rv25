-- ============================================================================
-- VOLUNTEER LOCATION TROUBLESHOOTING QUERIES
-- Run these in Supabase SQL Editor to diagnose why locations aren't saving
-- ============================================================================

-- 1. Check if RLS (Row Level Security) is enabled on volunteer_locations
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'volunteer_locations';

-- Expected: rls_enabled = true or false
-- If true, we need to check policies

-- ----------------------------------------------------------------------------

-- 2. Check RLS policies on volunteer_locations table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'volunteer_locations';

-- Expected: Should see INSERT policy that allows authenticated users

-- ----------------------------------------------------------------------------

-- 3. Check if there's a foreign key constraint issue
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'volunteer_locations';

-- Expected: Should show foreign key to users table on user_id column

-- ----------------------------------------------------------------------------

-- 4. Try manual INSERT to test if it works
-- Replace 'YOUR_USER_ID_HERE' with an actual volunteer user ID from users table

-- First, get a volunteer user ID:
SELECT id, email, first_name, last_name, role
FROM users
WHERE role = 'volunteer'
LIMIT 1;

-- Then try to insert (replace the UUID below with actual user_id from above):
/*
INSERT INTO volunteer_locations (user_id, lat, lng, accuracy)
VALUES (
  'YOUR_USER_ID_HERE'::uuid,
  10.2451,  -- Sample latitude for Talisay City
  123.8495, -- Sample longitude for Talisay City
  10.0
);
*/

-- If this fails, check the error message!

-- ----------------------------------------------------------------------------

-- 5. Check if there's a trigger that might be blocking inserts
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'volunteer_locations';

-- Expected: Might see a trigger for setting is_within_talisay_city

-- ----------------------------------------------------------------------------

-- 6. RECOMMENDED FIX: Create/Update RLS Policies

-- First, enable RLS if not already enabled
ALTER TABLE volunteer_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (optional - only if you want to recreate)
-- DROP POLICY IF EXISTS "Volunteers can insert their own locations" ON volunteer_locations;
-- DROP POLICY IF EXISTS "Volunteers can read their own locations" ON volunteer_locations;
-- DROP POLICY IF EXISTS "Admins can read all locations" ON volunteer_locations;

-- Create INSERT policy for volunteers
CREATE POLICY "Volunteers can insert their own locations"
ON volunteer_locations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'volunteer'
  )
);

-- Create SELECT policy for volunteers (own data)
CREATE POLICY "Volunteers can read their own locations"
ON volunteer_locations
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'barangay')
  )
);

-- Create SELECT policy for admins (all data)
CREATE POLICY "Admins can read all locations"
ON volunteer_locations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'barangay')
  )
);

-- ----------------------------------------------------------------------------

-- 7. Verify the policies were created
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'volunteer_locations';

-- ----------------------------------------------------------------------------

-- 8. Test INSERT again after creating policies
-- (Use the same INSERT statement from step 4)

-- ----------------------------------------------------------------------------
-- END OF TROUBLESHOOTING
-- ============================================================================
