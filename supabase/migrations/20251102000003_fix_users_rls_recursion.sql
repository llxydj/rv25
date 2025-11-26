-- Fix RLS policy recursion issue on users table
-- This migration addresses the "infinite recursion detected in policy for relation 'users'" error

-- First, drop all existing policies on the users table to avoid conflicts
DROP POLICY IF EXISTS "admin_read_all_users" ON public.users;
DROP POLICY IF EXISTS "admin_update_users" ON public.users;
DROP POLICY IF EXISTS "admin_delete_users" ON public.users;
DROP POLICY IF EXISTS "users_read_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_insert_own_profile_v2" ON public.users;

-- Re-enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create a function to check if user is admin without causing recursion
-- This function uses SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION is_admin_user(user_id uuid)
RETURNS boolean AS $$
DECLARE
  user_role text;
BEGIN
  -- Direct query that bypasses RLS due to SECURITY DEFINER
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

-- Policy: Users can read their own profile (simplest policy first)
CREATE POLICY "users_read_own_profile"
ON public.users FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Policy: Users can update their own profile
CREATE POLICY "users_update_own_profile"
ON public.users FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy: Users can insert their own profile (needed for Google OAuth flow)
CREATE POLICY "users_insert_own_profile"
ON public.users FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Policy: Only admins can read all users (for user management)
CREATE POLICY "admin_read_all_users"
ON public.users FOR SELECT
TO authenticated
USING (
  -- Use the function to check if user is admin, which bypasses RLS
  is_admin_user(auth.uid()) OR
  -- Always allow users to read their own record
  id = auth.uid()
);

-- Policy: Only admins can update users (for deactivation/activation)
CREATE POLICY "admin_update_users"
ON public.users FOR UPDATE
TO authenticated
USING (
  -- Use the function to check if user is admin, which bypasses RLS
  is_admin_user(auth.uid())
)
WITH CHECK (
  -- Use the function to check if user is admin, which bypasses RLS
  is_admin_user(auth.uid())
);

-- Policy: Only admins can delete users (soft delete)
CREATE POLICY "admin_delete_users"
ON public.users FOR DELETE
TO authenticated
USING (
  -- Use the function to check if user is admin, which bypasses RLS
  is_admin_user(auth.uid())
);

-- Add comments for documentation
COMMENT ON POLICY "admin_read_all_users" ON public.users IS 'Admins can read all users for management purposes';
COMMENT ON POLICY "admin_update_users" ON public.users IS 'Admins can update any user for management purposes';
COMMENT ON POLICY "admin_delete_users" ON public.users IS 'Admins can delete (soft delete) any user for management purposes';
COMMENT ON POLICY "users_read_own_profile" ON public.users IS 'Users can read their own profile';
COMMENT ON POLICY "users_update_own_profile" ON public.users IS 'Users can update their own profile';
COMMENT ON POLICY "users_insert_own_profile" ON public.users IS 'Users can insert their own profile (needed for Google OAuth flow)';
COMMENT ON FUNCTION is_admin_user(uuid) IS 'Function to check if user is admin, bypasses RLS to avoid recursion';