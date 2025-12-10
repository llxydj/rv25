-- Diagnostic: Check RLS Policies for Reporter Data Access
-- This will help identify why volunteers can't see reporter names

-- 1. Check if the incident exists and has a reporter_id
SELECT 
  '1. Incident Reporter Check' as diagnostic,
  i.id as incident_id,
  i.reporter_id,
  i.assigned_to,
  i.incident_type,
  i.status
FROM incidents i
WHERE i.id = '2274bdab-9933-43aa-a5b0-3e514924ebeb';

-- 2. Check if the reporter user exists and has name data
SELECT 
  '2. Reporter User Data Check' as diagnostic,
  u.id as user_id,
  u.first_name,
  u.last_name,
  u.email,
  u.role,
  u.phone_number,
  CASE 
    WHEN u.first_name IS NULL AND u.last_name IS NULL THEN '❌ No name data'
    WHEN u.first_name IS NULL OR u.last_name IS NULL THEN '⚠️ Partial name data'
    ELSE '✅ Has full name'
  END as name_status
FROM users u
WHERE u.id = (
  SELECT reporter_id 
  FROM incidents 
  WHERE id = '2274bdab-9933-43aa-a5b0-3e514924ebeb'
);

-- 3. Check RLS policies on users table
SELECT 
  '3. Users Table RLS Policies' as diagnostic,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- 4. Check if RLS is enabled on users table
SELECT 
  '4. RLS Status on Users Table' as diagnostic,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'users';

-- 5. Test query as if you were a volunteer (simulate volunteer access)
-- This will show what a volunteer can see
SELECT 
  '5. Volunteer Access Test' as diagnostic,
  'Note: Run this as a volunteer user to see what they can access' as instruction;

-- 6. Check the specific join query that should return reporter data
SELECT 
  '6. Test Reporter Join Query' as diagnostic,
  i.id as incident_id,
  i.reporter_id,
  u.id as reporter_user_id,
  u.first_name,
  u.last_name,
  u.email,
  CASE 
    WHEN u.id IS NULL THEN '❌ Reporter user not found or RLS blocked'
    WHEN u.first_name IS NULL AND u.last_name IS NULL THEN '⚠️ User exists but no name'
    ELSE '✅ Reporter data accessible'
  END as access_status
FROM incidents i
LEFT JOIN users u ON i.reporter_id = u.id
WHERE i.id = '2274bdab-9933-43aa-a5b0-3e514924ebeb';

-- 7. Check assigned volunteer data
SELECT 
  '7. Assigned Volunteer Check' as diagnostic,
  i.id as incident_id,
  i.assigned_to as assigned_volunteer_id,
  u.id as volunteer_user_id,
  u.first_name as volunteer_first_name,
  u.last_name as volunteer_last_name,
  u.email as volunteer_email,
  CASE 
    WHEN u.id IS NULL THEN '❌ Volunteer user not found or RLS blocked'
    WHEN u.first_name IS NULL AND u.last_name IS NULL THEN '⚠️ User exists but no name'
    ELSE '✅ Volunteer data accessible'
  END as access_status
FROM incidents i
LEFT JOIN users u ON i.assigned_to = u.id
WHERE i.id = '2274bdab-9933-43aa-a5b0-3e514924ebeb';

-- 8. Check if the volunteer policy exists
SELECT 
  '8. Volunteer Policy Check' as diagnostic,
  policyname,
  cmd,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Policy exists'
    ELSE '❌ Policy does NOT exist - this is the problem!'
  END as policy_status
FROM pg_policies
WHERE tablename = 'users' 
  AND policyname = 'volunteers_read_incident_participants'
GROUP BY policyname, cmd;

-- 9. List ALL policies on users table (to see what's currently active)
SELECT 
  '9. All Users Table Policies' as diagnostic,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd, policyname;

