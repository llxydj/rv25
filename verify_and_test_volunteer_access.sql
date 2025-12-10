-- Verify and Test Volunteer Access to Reporter Data
-- Run this after applying the fix to verify it's working

-- 1. Verify the policy exists
SELECT 
  '1. Policy Verification' as check_type,
  policyname,
  cmd,
  '✅ Policy exists' as status
FROM pg_policies
WHERE tablename = 'users' 
  AND policyname = 'volunteers_read_incident_participants';

-- 2. Verify the function exists
SELECT 
  '2. Function Verification' as check_type,
  proname as function_name,
  '✅ Function exists' as status
FROM pg_proc
WHERE proname = 'is_volunteer_user';

-- 3. Test the join query that volunteers should be able to run
-- This simulates what happens when a volunteer views an incident detail page
SELECT 
  '3. Test Volunteer Access Query' as check_type,
  i.id as incident_id,
  i.reporter_id,
  i.assigned_to,
  -- Reporter data
  r.id as reporter_user_id,
  r.first_name as reporter_first_name,
  r.last_name as reporter_last_name,
  r.email as reporter_email,
  CASE 
    WHEN r.id IS NULL THEN '❌ Reporter data blocked by RLS'
    WHEN r.first_name IS NULL AND r.last_name IS NULL THEN '⚠️ Reporter exists but no name data'
    ELSE '✅ Reporter data accessible'
  END as reporter_status,
  -- Assigned volunteer data
  v.id as assigned_volunteer_id,
  v.first_name as volunteer_first_name,
  v.last_name as volunteer_last_name,
  v.email as volunteer_email,
  CASE 
    WHEN v.id IS NULL THEN '❌ Volunteer data blocked by RLS'
    WHEN v.first_name IS NULL AND v.last_name IS NULL THEN '⚠️ Volunteer exists but no name data'
    ELSE '✅ Volunteer data accessible'
  END as volunteer_status
FROM incidents i
LEFT JOIN users r ON i.reporter_id = r.id
LEFT JOIN users v ON i.assigned_to = v.id
WHERE i.id = '2274bdab-9933-43aa-a5b0-3e514924ebeb';

-- 4. Check if the incident is assigned to a volunteer
SELECT 
  '4. Incident Assignment Check' as check_type,
  i.id as incident_id,
  i.assigned_to,
  u.id as assigned_user_id,
  u.email as assigned_user_email,
  u.role as assigned_user_role,
  CASE 
    WHEN u.role = 'volunteer' THEN '✅ Incident is assigned to a volunteer'
    WHEN u.role IS NULL THEN '⚠️ Incident is not assigned'
    ELSE '⚠️ Incident is assigned to a ' || u.role
  END as assignment_status
FROM incidents i
LEFT JOIN users u ON i.assigned_to = u.id
WHERE i.id = '2274bdab-9933-43aa-a5b0-3e514924ebeb';

-- 5. List all volunteers to help identify test users
SELECT 
  '5. Available Volunteers' as check_type,
  id as volunteer_id,
  email,
  first_name,
  last_name,
  role
FROM users
WHERE role = 'volunteer'
LIMIT 5;

