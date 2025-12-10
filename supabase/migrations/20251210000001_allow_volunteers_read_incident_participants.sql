-- Migration: Allow Volunteers to Read Reporter and Assigned Volunteer Data
-- Purpose: Fix "Anonymous Reporter" issue - volunteers need to see reporter names for assigned incidents
-- Date: 2025-12-10
-- IMPORTANT: This policy uses volunteer_profiles table to check if user is volunteer
-- to avoid infinite recursion that would occur if we queried users table for role

-- This policy allows volunteers to read user data (name, email) for:
-- 1. Reporters of incidents assigned to the volunteer
-- 2. Assigned volunteers of incidents (to see who else is assigned)
-- 3. Their own profile (already covered but included for completeness)

CREATE POLICY IF NOT EXISTS "volunteers_read_incident_participants"
ON public.users FOR SELECT
TO authenticated
USING (
  -- Allow if it's the current user's own profile
  id = auth.uid()
  OR
  -- Allow if current user has a volunteer profile AND is assigned to an incident where target user is the reporter
  -- We check volunteer_profiles instead of users.role to avoid recursion
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
  -- Allow admins to read all users (using the existing function to avoid recursion)
  is_admin_user(auth.uid())
);

-- Add comment for documentation
COMMENT ON POLICY "volunteers_read_incident_participants" ON public.users IS 
  'Allows volunteers to read user data (name, email) for reporters and assigned volunteers of incidents they are assigned to. Uses volunteer_profiles table to check volunteer status to avoid RLS recursion.';

