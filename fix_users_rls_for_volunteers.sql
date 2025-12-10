-- Fix: Allow Volunteers to Read Reporter and Assigned Volunteer Data
-- This creates/updates RLS policies to allow volunteers to see user data for incidents they're assigned to

-- IMPORTANT: Run this in Supabase SQL Editor with proper permissions

-- 1. Check current policies first (for reference)
SELECT 
  'Current Policies' as info,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'SELECT';

-- 2. Create policy to allow volunteers to read reporter data for assigned incidents
-- This allows volunteers to see reporter information for incidents they're assigned to
CREATE POLICY IF NOT EXISTS "Volunteers can view reporter data for assigned incidents"
ON users
FOR SELECT
TO authenticated
USING (
  -- Allow if the current user is a volunteer AND
  -- the user being queried is a reporter of an incident assigned to the current volunteer
  EXISTS (
    SELECT 1 
    FROM incidents i
    WHERE i.reporter_id = users.id
      AND i.assigned_to = auth.uid()
  )
  OR
  -- Also allow if the current user is a volunteer AND
  -- the user being queried is the assigned volunteer (for seeing who else is assigned)
  (id = auth.uid())
  OR
  -- Allow volunteers to see other volunteers (for seeing assigned volunteer info)
  (role = 'volunteer' AND EXISTS (
    SELECT 1 
    FROM incidents i
    WHERE i.assigned_to = users.id
      AND i.assigned_to = auth.uid()
  ))
);

-- 3. Alternative: More permissive policy (if the above is too restrictive)
-- This allows volunteers to read basic user info (name, email) for any user
-- but only for incidents they're involved with
DROP POLICY IF EXISTS "Volunteers can view user data for incident participants" ON users;

CREATE POLICY "Volunteers can view user data for incident participants"
ON users
FOR SELECT
TO authenticated
USING (
  -- Current user is a volunteer
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'volunteer')
  AND (
    -- Allow if user is reporter of an incident assigned to current volunteer
    EXISTS (
      SELECT 1 
      FROM incidents i
      WHERE i.reporter_id = users.id
        AND i.assigned_to = auth.uid()
    )
    OR
    -- Allow if user is assigned volunteer of an incident assigned to current volunteer
    -- (for seeing other volunteers on related incidents)
    EXISTS (
      SELECT 1 
      FROM incidents i
      WHERE i.assigned_to = users.id
        AND i.assigned_to = auth.uid()
    )
    OR
    -- Allow if it's the current user themselves
    users.id = auth.uid()
  )
);

-- 4. Verify the policy was created
SELECT 
  'Policy Created' as status,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'users' 
  AND policyname LIKE '%volunteer%'
ORDER BY policyname;

