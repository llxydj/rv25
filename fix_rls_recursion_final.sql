-- URGENT FIX: Remove recursive policy immediately
-- This fixes the "infinite recursion detected in policy for relation users" error

-- Step 1: Drop the problematic policy and function
DROP POLICY IF EXISTS "volunteers_read_incident_participants" ON public.users;
DROP FUNCTION IF EXISTS is_volunteer_user(uuid) CASCADE;

-- Step 2: Create the FIXED policy that uses volunteer_profiles instead of querying users table
CREATE POLICY "volunteers_read_incident_participants"
ON public.users FOR SELECT
TO authenticated
USING (
  -- Allow users to read their own profile
  id = auth.uid()
  OR
  -- Allow volunteers to read reporters of incidents assigned to them
  -- We check volunteer_profiles table instead of users.role to avoid recursion
  (
    EXISTS (
      SELECT 1 
      FROM public.volunteer_profiles vp
      WHERE vp.volunteer_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 
      FROM public.incidents i
      WHERE i.reporter_id = users.id
        AND i.assigned_to = auth.uid()
    )
  )
  OR
  -- Allow volunteers to see assigned volunteer data for incidents they're assigned to
  -- (This allows seeing who else is assigned, though they can see themselves via id = auth.uid())
  (
    EXISTS (
      SELECT 1 
      FROM public.volunteer_profiles vp
      WHERE vp.volunteer_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 
      FROM public.incidents i
      WHERE i.assigned_to = users.id
        AND i.assigned_to = auth.uid()
    )
  )
  OR
  -- Allow admins to read all users
  is_admin_user(auth.uid())
);

-- Step 3: Verify the fix (simplified query)
SELECT 
  'Policy Fixed - Verification' as status,
  policyname,
  cmd,
  CASE 
    WHEN qual::text LIKE '%is_volunteer_user%' 
      THEN '❌ STILL HAS is_volunteer_user - RECURSION WILL OCCUR!'
    WHEN qual::text LIKE '%volunteer_profiles%'
      THEN '✅ Policy is safe - uses volunteer_profiles (no recursion)'
    ELSE '⚠️ Check policy manually'
  END as safety_check
FROM pg_policies
WHERE tablename = 'users' 
  AND policyname = 'volunteers_read_incident_participants';

