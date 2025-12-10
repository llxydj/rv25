-- Simulate Volunteer Access to Check RLS
-- This helps diagnose what volunteers can actually see

-- IMPORTANT: To properly test, you need to:
-- 1. Get a volunteer user ID from your database
-- 2. Set the role context (if possible in Supabase SQL Editor)
-- 3. Or check the policies to see what conditions they have

-- Step 1: Find a volunteer user ID
SELECT 
  'Step 1: Find Volunteer User' as step,
  id as volunteer_user_id,
  email,
  first_name,
  last_name,
  role
FROM users
WHERE role = 'volunteer'
LIMIT 1;

-- Step 2: Check what that volunteer can see for the specific incident
-- Replace 'VOLUNTEER_USER_ID_HERE' with an actual volunteer ID from Step 1
SELECT 
  'Step 2: Test Volunteer Access to Incident' as step,
  i.id as incident_id,
  i.reporter_id,
  i.assigned_to,
  -- Try to get reporter data
  r.id as reporter_user_id,
  r.first_name as reporter_first_name,
  r.last_name as reporter_last_name,
  r.email as reporter_email,
  -- Try to get assigned volunteer data  
  v.id as assigned_volunteer_id,
  v.first_name as volunteer_first_name,
  v.last_name as volunteer_last_name,
  v.email as volunteer_email
FROM incidents i
LEFT JOIN users r ON i.reporter_id = r.id
LEFT JOIN users v ON i.assigned_to = v.id
WHERE i.id = '2274bdab-9933-43aa-a5b0-3e514924ebeb';

-- Step 3: Check RLS policies that might block this
SELECT 
  'Step 3: RLS Policies Analysis' as step,
  policyname,
  cmd,
  CASE 
    WHEN qual::text LIKE '%auth.uid()%' THEN 'Uses auth.uid() - might block if not same user'
    WHEN qual::text LIKE '%role%' THEN 'Uses role check'
    WHEN qual::text LIKE '%volunteer%' THEN 'Mentions volunteer'
    ELSE 'Other condition'
  END as policy_type,
  qual as policy_condition
FROM pg_policies
WHERE tablename = 'users' 
  AND cmd = 'SELECT';

