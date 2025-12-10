-- Fix: Admin Read All Users RLS Policy
-- Problem: The "admin_read_all_users" policy might be checking target user's role instead of current user's role
-- This causes "Anonymous Reporter" and null assigned volunteer issues for admins
-- Date: 2025-01-31

-- Drop ALL existing policies that might conflict (including the incorrectly named one)
DROP POLICY IF EXISTS "admin_read_all_users" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;

-- Ensure is_admin_user() function exists (from migration 20251102000003)
-- This function uses SECURITY DEFINER to bypass RLS and avoid recursion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_admin_user'
  ) THEN
    CREATE OR REPLACE FUNCTION is_admin_user(user_id uuid)
    RETURNS boolean AS $$
    DECLARE
      user_role text;
    BEGIN
      SELECT role INTO user_role 
      FROM public.users 
      WHERE id = user_id 
      LIMIT 1;
      
      RETURN user_role = 'admin';
    EXCEPTION 
      WHEN OTHERS THEN
        RETURN FALSE;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END $$;

-- Create the CORRECT policy that allows admins to read all users
-- Uses is_admin_user() function to check if CURRENT USER (auth.uid()) is admin
CREATE POLICY "admin_read_all_users"
ON public.users FOR SELECT
TO authenticated
USING (
  -- Allow users to read their own profile
  id = auth.uid()
  OR
  -- Allow admins to read all users (checking CURRENT user's role, not target user's role)
  is_admin_user(auth.uid())
);

-- Also ensure volunteers_read_incident_participants policy exists and works
-- This policy should already exist, but let's make sure it's correct
-- The policy should allow:
-- 1. Users to read their own profile
-- 2. Volunteers to read reporters/assignees of incidents assigned to them
-- 3. Admins to read all users (via is_admin_user)

-- Verify the policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'volunteers_read_incident_participants'
  ) THEN
    RAISE NOTICE 'volunteers_read_incident_participants policy does not exist - it should be created by migration 20251210000001';
  ELSE
    RAISE NOTICE '✅ volunteers_read_incident_participants policy exists';
  END IF;
END $$;

-- Add comment
COMMENT ON POLICY "admin_read_all_users" ON public.users IS 
  'Allows users to read their own profile, and admins to read all users. Uses is_admin_user() function to check admin status without recursion.';

