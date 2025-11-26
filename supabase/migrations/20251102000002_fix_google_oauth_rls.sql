-- Fix RLS policies to allow Google OAuth users to create their profile
-- This fixes the redirect loop issue where users get stuck between login and registration

-- Enable RLS on users table (should already be enabled, but just to be sure)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own profile (needed for Google OAuth flow)
CREATE POLICY "users_insert_own_profile_v2"
ON public.users FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Add comment for documentation
COMMENT ON POLICY "users_insert_own_profile_v2" ON public.users IS 'Users can insert their own profile (needed for Google OAuth flow) - v2 to avoid duplication';