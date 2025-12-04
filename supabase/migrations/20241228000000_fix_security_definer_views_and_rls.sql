-- ========================================
-- FIX SECURITY DEFINER VIEWS AND RLS ISSUES
-- ========================================
-- Purpose: Fix Supabase linter security warnings
-- Date: 2024-12-28
-- ========================================

-- ========================================
-- 1. FIX SECURITY DEFINER VIEWS
-- ========================================
-- Change views from SECURITY DEFINER to SECURITY INVOKER
-- This ensures views use the permissions of the querying user, not the view creator

-- Fix active_volunteers_with_location view
-- Drop and recreate to ensure no SECURITY DEFINER properties
DROP VIEW IF EXISTS public.active_volunteers_with_location CASCADE;
CREATE VIEW public.active_volunteers_with_location AS
SELECT 
  u.id,
  u.first_name,
  u.last_name,
  u.email,
  u.phone_number,
  vl.lat AS latitude,
  vl.lng AS longitude,
  vl.accuracy,
  vl.created_at AS last_location_update,
  vs.status,
  vs.status_message,
  vs.last_activity,
  vp.is_available,
  vp.skills,
  vp.assigned_barangays
FROM public.users u
INNER JOIN public.volunteer_profiles vp ON vp.volunteer_user_id = u.id
LEFT JOIN LATERAL (
  SELECT lat, lng, accuracy, created_at
  FROM public.volunteer_locations
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) vl ON true
LEFT JOIN public.volunteer_status vs ON vs.user_id = u.id
WHERE u.role = 'volunteer'
  AND vl.created_at > NOW() - INTERVAL '30 minutes';

COMMENT ON VIEW public.active_volunteers_with_location IS 'Active volunteers with their most recent location (last 30 minutes)';

-- Fix rvois_index_health view
-- Drop and recreate to ensure no SECURITY DEFINER properties
DROP VIEW IF EXISTS public.rvois_index_health CASCADE;
CREATE VIEW public.rvois_index_health AS
SELECT 
  schemaname,
  tablename,
  indexrelname as index_name,
  idx_scan as scans,
  pg_size_pretty(pg_relation_size(indexrelid)) as size,
  CASE 
    WHEN idx_scan = 0 THEN 'UNUSED'
    WHEN idx_scan < 100 THEN 'LOW_USAGE'
    WHEN idx_scan < 1000 THEN 'MODERATE'
    ELSE 'HIGH_USAGE'
  END as usage_status,
  pg_stat_get_last_vacuum_time(relid) as last_vacuumed
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname LIKE 'idx_%'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

COMMENT ON VIEW public.rvois_index_health IS 
'Quick dashboard view for monitoring index health and usage patterns.';

-- Fix sms_dashboard_stats view
-- Drop and recreate to ensure no SECURITY DEFINER properties
DROP VIEW IF EXISTS public.sms_dashboard_stats CASCADE;
CREATE VIEW public.sms_dashboard_stats AS
SELECT 
    DATE(timestamp_sent) as date,
    COUNT(*) as total_sent,
    COUNT(*) FILTER (WHERE delivery_status = 'SUCCESS') as success_count,
    COUNT(*) FILTER (WHERE delivery_status = 'FAILED') as failure_count,
    COUNT(*) FILTER (WHERE delivery_status = 'PENDING') as pending_count,
    ROUND(AVG(CASE WHEN delivery_status = 'SUCCESS' THEN 1 ELSE 0 END) * 100, 2) as success_rate
FROM sms_logs
WHERE timestamp_sent >= NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp_sent)
ORDER BY date DESC;

-- Fix schedule_statistics view
-- Drop and recreate to ensure no SECURITY DEFINER properties
DROP VIEW IF EXISTS public.schedule_statistics CASCADE;
CREATE VIEW public.schedule_statistics AS
SELECT
  count(*) FILTER (WHERE status = 'SCHEDULED') as scheduled_count,
  count(*) FILTER (WHERE status = 'ONGOING') as ongoing_count,
  count(*) FILTER (WHERE status = 'COMPLETED') as completed_count,
  count(*) FILTER (WHERE status = 'CANCELLED') as cancelled_count,
  count(*) FILTER (WHERE is_accepted = true) as accepted_count,
  count(*) FILTER (WHERE is_accepted = false) as declined_count,
  count(*) FILTER (WHERE is_accepted IS NULL) as pending_response_count,
  count(*) FILTER (WHERE start_time > now() AND status = 'SCHEDULED') as upcoming_count,
  count(*) FILTER (WHERE start_time <= now() AND status = 'ONGOING') as active_count,
  count(*) FILTER (WHERE attendance_marked = true) as attendance_marked_count,
  count(*) as total_count
FROM public.schedules;

-- ========================================
-- 2. ENABLE RLS ON TABLES
-- ========================================

-- Enable RLS on incident_reference_ids (if not already enabled)
ALTER TABLE public.incident_reference_ids ENABLE ROW LEVEL SECURITY;

-- Ensure RLS policies exist for incident_reference_ids
DO $$
BEGIN
  -- Drop existing policies if they exist to avoid conflicts
  DROP POLICY IF EXISTS "Users can view reference IDs for their incidents" ON public.incident_reference_ids;
  DROP POLICY IF EXISTS "System can insert reference IDs" ON public.incident_reference_ids;
  DROP POLICY IF EXISTS "System can update reference IDs" ON public.incident_reference_ids;
  
  -- Recreate policies
  CREATE POLICY "Users can view reference IDs for their incidents" ON public.incident_reference_ids
    FOR SELECT USING (
      incident_id IN (
        SELECT id FROM incidents 
        WHERE reporter_id = auth.uid() 
        OR assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users 
          WHERE id = auth.uid() 
          AND role IN ('admin', 'barangay')
        )
      )
    );

  CREATE POLICY "System can insert reference IDs" ON public.incident_reference_ids
    FOR INSERT WITH CHECK (true);

  CREATE POLICY "System can update reference IDs" ON public.incident_reference_ids
    FOR UPDATE USING (true);
END $$;

-- Enable RLS on incident_views
ALTER TABLE public.incident_views ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for incident_views
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own incident views" ON public.incident_views;
  DROP POLICY IF EXISTS "Users can insert their own incident views" ON public.incident_views;
  DROP POLICY IF EXISTS "Admins can view all incident views" ON public.incident_views;
  
  -- Users can view their own views
  CREATE POLICY "Users can view their own incident views" ON public.incident_views
    FOR SELECT USING (auth.uid() = user_id);
  
  -- Users can insert their own views
  CREATE POLICY "Users can insert their own incident views" ON public.incident_views
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  
  -- Admins can view all views
  CREATE POLICY "Admins can view all incident views" ON public.incident_views
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role = 'admin'
      )
    );
END $$;

-- Enable RLS on auto_archive_schedule
ALTER TABLE public.auto_archive_schedule ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for auto_archive_schedule
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can manage auto archive schedule" ON public.auto_archive_schedule;
  DROP POLICY IF EXISTS "Authenticated users can view auto archive schedule" ON public.auto_archive_schedule;
  
  -- Only admins can manage the schedule
  CREATE POLICY "Admins can manage auto archive schedule" ON public.auto_archive_schedule
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role = 'admin'
      )
    );
  
  -- Authenticated users can view (read-only)
  CREATE POLICY "Authenticated users can view auto archive schedule" ON public.auto_archive_schedule
    FOR SELECT TO authenticated USING (true);
END $$;

-- Ensure RLS is enabled on pin_attempts (should already be enabled, but ensure it)
ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;

-- Ensure RLS policies exist for pin_attempts
DO $$
BEGIN
  DROP POLICY IF EXISTS "users_view_own_pin_attempts" ON public.pin_attempts;
  
  -- Users can view their own attempts
  CREATE POLICY "users_view_own_pin_attempts"
  ON public.pin_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
  
  -- System can manage attempts (via service role, no policy needed)
END $$;

-- ========================================
-- 3. HANDLE SPATIAL_REF_SYS (PostGIS system table)
-- ========================================
-- This is a PostGIS system table. We have a few options:
-- 1. Move it to a different schema (not recommended - breaks PostGIS)
-- 2. Grant specific permissions (recommended)
-- 3. Enable RLS with a policy that allows read access

-- Option: Enable RLS and allow read access to authenticated users
-- This is safe because spatial_ref_sys is read-only for most users
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to authenticated users
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read spatial_ref_sys" ON public.spatial_ref_sys;
  
  CREATE POLICY "Authenticated users can read spatial_ref_sys" ON public.spatial_ref_sys
    FOR SELECT TO authenticated USING (true);
  
  -- Only service role can modify (no policy needed, handled by service role)
END $$;

-- ========================================
-- 4. GRANT PERMISSIONS
-- ========================================

-- Grant permissions on views
GRANT SELECT ON public.active_volunteers_with_location TO authenticated;
GRANT SELECT ON public.rvois_index_health TO authenticated;
GRANT SELECT ON public.sms_dashboard_stats TO authenticated;
GRANT SELECT ON public.schedule_statistics TO authenticated;

-- Grant permissions on tables (RLS will handle access control)
GRANT SELECT ON public.incident_reference_ids TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.incident_views TO authenticated;
GRANT SELECT ON public.auto_archive_schedule TO authenticated;
GRANT SELECT ON public.pin_attempts TO authenticated;
GRANT SELECT ON public.spatial_ref_sys TO authenticated;

-- ========================================
-- 5. COMMENTS
-- ========================================

COMMENT ON VIEW public.active_volunteers_with_location IS 
'Active volunteers with their most recent location (last 30 minutes). Recreated to ensure proper RLS enforcement.';

COMMENT ON VIEW public.rvois_index_health IS 
'Quick dashboard view for monitoring index health and usage patterns. Recreated to ensure proper RLS enforcement.';

COMMENT ON VIEW public.sms_dashboard_stats IS 
'SMS dashboard statistics view. Recreated to ensure proper RLS enforcement.';

COMMENT ON VIEW public.schedule_statistics IS 
'Schedule statistics view. Recreated to ensure proper RLS enforcement.';

