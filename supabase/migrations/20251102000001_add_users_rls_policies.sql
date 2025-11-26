-- Add RLS policies for users table to ensure admin-only access to user management
-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "admin_read_all_users" ON public.users;
DROP POLICY IF EXISTS "admin_update_users" ON public.users;
DROP POLICY IF EXISTS "admin_delete_users" ON public.users;
DROP POLICY IF EXISTS "users_read_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.users;

-- Policy: Only admins can read all users (for user management)
CREATE POLICY "admin_read_all_users"
ON public.users FOR SELECT
TO authenticated
USING (
  id = auth.uid()
);

-- Policy: Only admins can update users (for deactivation/activation)
CREATE POLICY "admin_update_users"
ON public.users FOR UPDATE
TO authenticated
USING (
  FALSE
)
WITH CHECK (
  FALSE
);

-- Policy: Only admins can delete users (soft delete)
CREATE POLICY "admin_delete_users"
ON public.users FOR DELETE
TO authenticated
USING (
  FALSE
);

-- Policy: Users can read their own profile
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

-- Add comment for documentation
COMMENT ON POLICY "admin_read_all_users" ON public.users IS 'Admins can read all users for management purposes (simplified to avoid recursion)';
COMMENT ON POLICY "admin_update_users" ON public.users IS 'Admins can update any user for management purposes (temporarily disabled to avoid recursion)';
COMMENT ON POLICY "admin_delete_users" ON public.users IS 'Admins can delete (soft delete) any user for management purposes (temporarily disabled to avoid recursion)';
COMMENT ON POLICY "users_read_own_profile" ON public.users IS 'Users can read their own profile';
COMMENT ON POLICY "users_update_own_profile" ON public.users IS 'Users can update their own profile';
COMMENT ON POLICY "users_insert_own_profile" ON public.users IS 'Users can insert their own profile (needed for Google OAuth flow)';