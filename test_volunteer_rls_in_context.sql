-- Test RLS Policy in Context
-- This helps verify the policy works correctly

-- IMPORTANT: The SQL Editor runs with elevated privileges, so RLS might not apply
-- The real test must be done in the browser as a logged-in volunteer

-- 1. Check the specific incident and its assignment
SELECT 
  '1. Incident Details' as check_type,
  i.id as incident_id,
  i.reporter_id,
  i.assigned_to,
  i.status,
  i.incident_type
FROM incidents i
WHERE i.id = '2274bdab-9933-43aa-a5b0-3e514924ebeb';

-- 2. Check reporter data (this should work in SQL Editor, but might be blocked by RLS in app)
SELECT 
  '2. Reporter Data Check' as check_type,
  u.id as reporter_id,
  u.first_name,
  u.last_name,
  u.email,
  u.role,
  CASE 
    WHEN u.first_name IS NOT NULL AND u.last_name IS NOT NULL 
      THEN u.first_name || ' ' || u.last_name
    WHEN u.first_name IS NOT NULL 
      THEN u.first_name
    WHEN u.last_name IS NOT NULL 
      THEN u.last_name
    WHEN u.email IS NOT NULL 
      THEN u.email
    ELSE 'No name data'
  END as display_name
FROM users u
WHERE u.id = (
  SELECT reporter_id 
  FROM incidents 
  WHERE id = '2274bdab-9933-43aa-a5b0-3e514924ebeb'
);

-- 3. Check assigned volunteer data
SELECT 
  '3. Assigned Volunteer Check' as check_type,
  u.id as volunteer_id,
  u.first_name,
  u.last_name,
  u.email,
  u.role,
  CASE 
    WHEN u.first_name IS NOT NULL AND u.last_name IS NOT NULL 
      THEN u.first_name || ' ' || u.last_name
    WHEN u.first_name IS NOT NULL 
      THEN u.first_name
    WHEN u.last_name IS NOT NULL 
      THEN u.last_name
    WHEN u.email IS NOT NULL 
      THEN u.email
    ELSE 'No name data'
  END as display_name
FROM users u
WHERE u.id = (
  SELECT assigned_to 
  FROM incidents 
  WHERE id = '2274bdab-9933-43aa-a5b0-3e514924ebeb'
);

-- 4. Simulate what a volunteer would see (if they're assigned to this incident)
-- Note: This will show data in SQL Editor, but RLS will apply in the actual app
SELECT 
  '4. Simulated Volunteer View' as check_type,
  i.id as incident_id,
  i.assigned_to,
  CASE 
    WHEN i.assigned_to IS NULL THEN '⚠️ Incident is NOT assigned - volunteers cannot see reporter data'
    WHEN i.assigned_to IN (
      SELECT id FROM users WHERE role = 'volunteer'
    ) THEN '✅ Incident is assigned to a volunteer - they SHOULD see reporter data'
    ELSE '⚠️ Incident is assigned to a non-volunteer'
  END as assignment_status,
  r.first_name || ' ' || r.last_name as reporter_name,
  v.first_name || ' ' || v.last_name as assigned_volunteer_name
FROM incidents i
LEFT JOIN users r ON i.reporter_id = r.id
LEFT JOIN users v ON i.assigned_to = v.id
WHERE i.id = '2274bdab-9933-43aa-a5b0-3e514924ebeb';

-- 5. Check which volunteer is assigned (if any)
SELECT 
  '5. Assigned Volunteer Details' as check_type,
  i.assigned_to,
  v.email as assigned_volunteer_email,
  v.first_name || ' ' || v.last_name as assigned_volunteer_name,
  v.role::text as assigned_volunteer_role,
  CASE 
    WHEN i.assigned_to IS NULL THEN '❌ NOT ASSIGNED - Volunteer must be assigned to see reporter data'
    WHEN v.role = 'volunteer' THEN '✅ Assigned to volunteer - they can see reporter data when logged in'
    ELSE '⚠️ Assigned to ' || COALESCE(v.role::text, 'no role found')
  END as status
FROM incidents i
LEFT JOIN users v ON i.assigned_to = v.id
WHERE i.id = '2274bdab-9933-43aa-a5b0-3e514924ebeb';