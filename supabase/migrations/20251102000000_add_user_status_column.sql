-- Add status column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Add comment for documentation
COMMENT ON COLUMN public.users.status IS 'User account status: active or inactive';