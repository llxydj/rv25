-- ========================================
-- CREATE PIN ATTEMPTS TRACKING TABLE
-- ========================================
-- Purpose: Track PIN verification attempts for rate limiting and brute force protection
-- Date: 2025-01-28
-- ========================================

-- Create pin_attempts table
CREATE TABLE IF NOT EXISTS public.pin_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pin_attempts_user 
  ON public.pin_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_pin_attempts_locked_until 
  ON public.pin_attempts(locked_until) 
  WHERE locked_until IS NOT NULL;

-- Enable RLS
ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own attempts
CREATE POLICY "users_view_own_pin_attempts"
ON public.pin_attempts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: System can insert/update attempts (via service role)
-- This will be handled by service role client in API routes

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_pin_attempts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pin_attempts_updated_at
BEFORE UPDATE ON public.pin_attempts
FOR EACH ROW
EXECUTE FUNCTION update_pin_attempts_updated_at();

-- Comments
COMMENT ON TABLE public.pin_attempts IS 
  'Tracks PIN verification attempts for rate limiting and brute force protection';
COMMENT ON COLUMN public.pin_attempts.attempt_count IS 
  'Number of consecutive failed attempts';
COMMENT ON COLUMN public.pin_attempts.locked_until IS 
  'Account locked until this timestamp (NULL if not locked)';

