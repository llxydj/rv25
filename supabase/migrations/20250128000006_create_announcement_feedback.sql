-- ========================================
-- CREATE ANNOUNCEMENT FEEDBACK TABLE
-- ========================================
-- Purpose: Allow users to rate and provide feedback on announcements
-- Date: 2025-01-28
-- ========================================

-- Create announcement_feedback table
CREATE TABLE IF NOT EXISTS public.announcement_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(announcement_id, user_id) -- One feedback per user per announcement
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_announcement_feedback_announcement 
  ON public.announcement_feedback(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_feedback_user 
  ON public.announcement_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_feedback_created_at 
  ON public.announcement_feedback(created_at);

-- Enable RLS
ALTER TABLE public.announcement_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own feedback
CREATE POLICY "users_insert_own_feedback"
ON public.announcement_feedback
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own feedback
CREATE POLICY "users_update_own_feedback"
ON public.announcement_feedback
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view all feedback (for ratings display)
CREATE POLICY "users_view_all_feedback"
ON public.announcement_feedback
FOR SELECT
TO authenticated
USING (true);

-- Policy: Admins can view and delete all feedback
CREATE POLICY "admins_manage_feedback"
ON public.announcement_feedback
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_announcement_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_announcement_feedback_updated_at
BEFORE UPDATE ON public.announcement_feedback
FOR EACH ROW
EXECUTE FUNCTION update_announcement_feedback_updated_at();

-- Comments
COMMENT ON TABLE public.announcement_feedback IS 
  'Stores user ratings and feedback for announcements';
COMMENT ON COLUMN public.announcement_feedback.rating IS 
  'Rating from 1 (poor) to 5 (excellent)';
COMMENT ON COLUMN public.announcement_feedback.comment IS 
  'Optional text feedback from the user';

