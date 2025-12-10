-- IMMEDIATE FIX: Allow Volunteers to Read Reporter Data
-- Run this in Supabase SQL Editor to fix the issue right away
-- This will allow volunteers to see reporter names for incidents they're assigned to

-- Step 1: Create helper function to check if user is volunteer (avoids RLS recursion)
CREATE OR REPLACE FUNCTION is_volunteer_user(user_id uuid)
RETURNS boolean AS $$
DECLARE
  user_role text;
BEGIN
  -- Direct query that bypasses RLS due to SECURITY DEFINER
  SELECT role INTO user_role 
  FROM public.users 
  WHERE id = user_id 
  LIMIT 1;
  
  RETURN user_role = 'volunteer';
EXCEPTION 
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create policy to allow volunteers to read reporter and assigned volunteer data
DROP POLICY IF EXISTS "volunteers_read_incident_participants" ON public.users;

CREATE POLICY "volunteers_read_incident_participants"
ON public.users FOR SELECT
TO authenticated
USING (
  -- Allow if it's the current user's own profile
  id = auth.uid()
  OR
  -- Allow if current user is a volunteer AND the target user is a reporter of an incident assigned to them
  (
    is_volunteer_user(auth.uid())
    AND EXISTS (
      SELECT 1 
      FROM public.incidents i
      WHERE i.reporter_id = users.id
        AND i.assigned_to = auth.uid()
    )
  )
  OR
  -- Allow if current user is a volunteer AND the target user is the assigned volunteer of an incident assigned to them
  -- (This allows seeing who is assigned to incidents - which could be themselves or someone else if reassigned)
  (
    is_volunteer_user(auth.uid())
    AND EXISTS (
      SELECT 1 
      FROM public.incidents i
      WHERE i.assigned_to = users.id
        AND i.assigned_to = auth.uid()
    )
  )
  OR
  -- Allow admins to read all users (using the existing function to avoid recursion)
  is_admin_user(auth.uid())
);

-- Step 3: Verify the policy was created
SELECT 
  'Policy Created' as status,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'users' 
  AND policyname = 'volunteers_read_incident_participants';

-- Step 4: Test query (replace with actual volunteer user ID and incident ID)
-- This simulates what a volunteer should be able to see
SELECT 
  'Test Query' as check_type,
  i.id as incident_id,
  i.reporter_id,
  r.first_name as reporter_first_name,
  r.last_name as reporter_last_name,
  r.email as reporter_email,
  i.assigned_to,
  v.first_name as volunteer_first_name,
  v.last_name as volunteer_last_name
FROM incidents i
LEFT JOIN users r ON i.reporter_id = r.id
LEFT JOIN users v ON i.assigned_to = v.id
WHERE i.id = '2274bdab-9933-43aa-a5b0-3e514924ebeb';

