-- Add Volunteer Status History Tracking
-- This enables auditing of status changes over time

BEGIN;

-- =====================================================
-- 1. CREATE STATUS HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.volunteer_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint to ensure status values are valid
  CONSTRAINT valid_status_values CHECK (
    old_status IN ('available', 'on_task', 'offline', 'unavailable') OR old_status IS NULL
  ),
  CONSTRAINT valid_new_status_values CHECK (
    new_status IN ('available', 'on_task', 'offline', 'unavailable')
  )
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_volunteer_status_history_user 
  ON public.volunteer_status_history(user_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_volunteer_status_history_status 
  ON public.volunteer_status_history(new_status, changed_at DESC);

COMMENT ON TABLE public.volunteer_status_history 
IS 'Audit log of volunteer status changes for accountability and analysis';

COMMENT ON COLUMN public.volunteer_status_history.changed_by 
IS 'User who triggered the status change (NULL for automatic changes)';

COMMENT ON COLUMN public.volunteer_status_history.reason 
IS 'Optional reason for status change (e.g., "Assigned to incident #123")';


-- =====================================================
-- 2. ENABLE RLS
-- =====================================================

ALTER TABLE public.volunteer_status_history ENABLE ROW LEVEL SECURITY;

-- Volunteers can view their own history
CREATE POLICY volunteer_status_history_own ON public.volunteer_status_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins and barangay users can view all history
CREATE POLICY volunteer_status_history_admin_view ON public.volunteer_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'barangay')
    )
  );

-- Only admins can insert history (manual overrides)
CREATE POLICY volunteer_status_history_admin_insert ON public.volunteer_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- =====================================================
-- 3. CREATE TRIGGER FUNCTION FOR AUTO-LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION log_volunteer_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only log if status actually changed
  IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.volunteer_status_history (
      user_id,
      old_status,
      new_status,
      changed_by,
      reason
    ) VALUES (
      NEW.user_id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status,
      auth.uid(), -- Current user if available
      NEW.status_message -- Use status_message as reason
    );
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION log_volunteer_status_change() 
IS 'Automatically logs status changes to volunteer_status_history table';


-- =====================================================
-- 4. ATTACH TRIGGER TO STATUS TABLE
-- =====================================================

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_log_volunteer_status_change ON public.volunteer_real_time_status;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER trigger_log_volunteer_status_change
  AFTER INSERT OR UPDATE OF status
  ON public.volunteer_real_time_status
  FOR EACH ROW
  EXECUTE FUNCTION log_volunteer_status_change();


-- =====================================================
-- 5. CREATE HELPER VIEW FOR RECENT CHANGES
-- =====================================================

CREATE OR REPLACE VIEW public.recent_volunteer_status_changes AS
SELECT 
  vsh.id,
  vsh.user_id,
  u.first_name,
  u.last_name,
  u.email,
  vsh.old_status,
  vsh.new_status,
  vsh.reason,
  vsh.changed_at,
  cb.first_name AS changed_by_first_name,
  cb.last_name AS changed_by_last_name
FROM public.volunteer_status_history vsh
INNER JOIN public.users u ON u.id = vsh.user_id
LEFT JOIN public.users cb ON cb.id = vsh.changed_by
WHERE vsh.changed_at > NOW() - INTERVAL '24 hours'
ORDER BY vsh.changed_at DESC;

GRANT SELECT ON public.recent_volunteer_status_changes TO authenticated;

COMMENT ON VIEW public.recent_volunteer_status_changes 
IS 'Shows volunteer status changes from the last 24 hours with user details';


-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON public.volunteer_status_history TO authenticated;
GRANT INSERT ON public.volunteer_status_history TO authenticated; -- RLS controls who can actually insert


COMMIT;

-- Verify the setup
SELECT 'Status history tracking installed successfully!' AS status;
SELECT COUNT(*) AS history_table_exists 
FROM information_schema.tables 
WHERE table_name = 'volunteer_status_history';
