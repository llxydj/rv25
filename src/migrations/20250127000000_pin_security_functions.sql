-- PIN Security Functions for bcrypt hashing and verification
-- This migration creates database functions for PIN hashing and verification
-- Note: Requires pgcrypto extension and bcrypt extension (or use application-level bcrypt)

-- Add pin_enabled column if not exists (for user preference)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS pin_enabled BOOLEAN DEFAULT true;

-- Create function to hash PIN using bcrypt
-- Note: This uses application-level bcrypt (bcryptjs) for security
-- The database function is a placeholder - actual hashing happens in API routes
CREATE OR REPLACE FUNCTION public.hash_pin(pin_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function is a placeholder
  -- Actual bcrypt hashing is done in the API route using bcryptjs
  -- This allows the database to store the hash but doesn't expose bcrypt in SQL
  RETURN NULL;
END;
$$;

-- Create function to verify PIN
-- Note: Actual verification happens in API routes using bcryptjs
CREATE OR REPLACE FUNCTION public.verify_pin(pin_input TEXT, pin_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function is a placeholder
  -- Actual bcrypt verification is done in the API route using bcryptjs
  RETURN FALSE;
END;
$$;

-- Add comment
COMMENT ON COLUMN public.users.pin_hash IS 'BCrypt hashed 4-digit PIN for user account security (admin, volunteer, resident only)';
COMMENT ON COLUMN public.users.pin_enabled IS 'Whether PIN security is enabled for this user (default: true, barangay users excluded)';

