-- URGENT FIX: Remove the recursive policy and create a non-recursive version
-- This fixes the "infinite recursion detected in policy for relation users" error

-- Step 1: DROP the problematic policy immediately
DROP POLICY IF EXISTS "volunteers_read_incident_participants" ON public.users;

-- Step 2: We'll check if user is volunteer by looking at volunteer_profiles table
-- This avoids querying users table and prevents recursion

-- Step 3: Create a NEW policy that avoids recursion
-- Instead of checking role via users table, we check volunteer_profiles table
-- This completely avoids querying users table from within the policy
CREATE POLICY "volunteers_read_incident_participants"
ON public.users FOR SELECT
TO authenticated
USING (
  -- Allow if it's the current user's own profile
  id = auth.uid()
  OR
  -- Allow if current user has a volunteer profile AND is assigned to an incident where target user is the reporter
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

-- Step 4: Verify the policy was created
SELECT 
  'Policy Fixed' as status,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'users' 
  AND policyname = 'volunteers_read_incident_participants';

