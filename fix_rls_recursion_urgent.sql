-- URGENT FIX: Remove recursive policy immediately
-- The policy still has is_volunteer_user() which causes infinite recursion

-- Step 1: DROP the problematic policy immediately
DROP POLICY IF EXISTS "volunteers_read_incident_participants" ON public.users;

-- Step 2: Also drop the is_volunteer_user function if it exists (it's causing the recursion)
DROP FUNCTION IF EXISTS is_volunteer_user(uuid);

-- Step 3: Create the FIXED policy that uses volunteer_profiles instead
-- This completely avoids querying users table and prevents recursion
CREATE POLICY "volunteers_read_incident_participants"
ON public.users FOR SELECT
TO authenticated
USING (
  -- Allow if it's the current user's own profile
  id = auth.uid()
  OR
  -- Allow if current user has a volunteer profile AND is assigned to an incident where target user is the reporter
  -- We check volunteer_profiles table instead of users table to avoid recursion
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
  -- Allow if current user has a volunteer profile AND is assigned to an incident where target user is the assigned volunteer
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
  -- Allow admins to read all users (using the existing function which should work)
  is_admin_user(auth.uid())
);

-- Step 4: Verify the policy was created correctly (should NOT have is_volunteer_user)
SELECT 
  'Policy Fixed - Verification' as status,
  policyname,
  cmd,
  CASE 
    WHEN pg_get_expr((SELECT polqual FROM pg_policy WHERE polname = policyname AND polrelid = (SELECT oid FROM pg_class WHERE relname = 'users')), (SELECT oid FROM pg_class WHERE relname = 'users'))::text LIKE '%is_volunteer_user%' 
      THEN '❌ STILL HAS is_volunteer_user - RECURSION WILL OCCUR!'
    ELSE '✅ Policy is safe - no is_volunteer_user()'
  END as safety_check
FROM pg_policies
WHERE tablename = 'users' 
  AND policyname = 'volunteers_read_incident_participants';

