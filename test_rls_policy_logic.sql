-- Test RLS Policy Logic
-- This verifies the policy conditions work correctly

-- 1. Check if the policy condition would work for the specific incident
-- This simulates what happens when volunteer views the incident
SELECT 
  '1. Policy Condition Test' as check_type,
  i.id as incident_id,
  i.reporter_id,
  i.assigned_to as volunteer_id,
  v.email as volunteer_email,
  r.id as reporter_user_id,
  r.first_name || ' ' || r.last_name as reporter_name,
  -- Test the policy condition manually
  CASE 
    WHEN i.assigned_to IS NOT NULL AND i.reporter_id IS NOT NULL THEN
      CASE 
        WHEN EXISTS (
          SELECT 1 
          FROM incidents i2
          WHERE i2.reporter_id = r.id
            AND i2.assigned_to = i.assigned_to
            AND i2.id = i.id
        ) THEN '✅ Policy condition would PASS - volunteer can see reporter'
        ELSE '❌ Policy condition would FAIL'
      END
    ELSE '⚠️ Missing assignment or reporter'
  END as policy_test_result
FROM incidents i
LEFT JOIN users r ON i.reporter_id = r.id
LEFT JOIN users v ON i.assigned_to = v.id
WHERE i.id = '2274bdab-9933-43aa-a5b0-3e514924ebeb';

-- 2. Test the is_volunteer_user function
SELECT 
  '2. Function Test' as check_type,
  id as user_id,
  email,
  role,
  is_volunteer_user(id) as function_result,
  CASE 
    WHEN is_volunteer_user(id) AND role = 'volunteer' THEN '✅ Function works correctly'
    WHEN NOT is_volunteer_user(id) AND role != 'volunteer' THEN '✅ Function works correctly'
    ELSE '❌ Function mismatch'
  END as function_status
FROM users
WHERE id = '9af11edc-10a7-47c8-8a2c-4b91abf7af97'; -- The assigned volunteer

-- 3. Check if reporter data exists and has name
SELECT 
  '3. Reporter Data Availability' as check_type,
  u.id as reporter_id,
  u.first_name,
  u.last_name,
  u.email,
  CASE 
    WHEN u.first_name IS NOT NULL AND u.last_name IS NOT NULL 
      THEN '✅ Has full name: ' || u.first_name || ' ' || u.last_name
    WHEN u.first_name IS NOT NULL 
      THEN '⚠️ Only first name: ' || u.first_name
    WHEN u.last_name IS NOT NULL 
      THEN '⚠️ Only last name: ' || u.last_name
    WHEN u.email IS NOT NULL 
      THEN '⚠️ Only email: ' || u.email
    ELSE '❌ No name or email data'
  END as name_status
FROM users u
WHERE u.id = (
  SELECT reporter_id 
  FROM incidents 
  WHERE id = '2274bdab-9933-43aa-a5b0-3e514924ebeb'
);

