-- ===================================================================
-- ADDITIONAL PERFORMANCE INDEXES FOR OPTIMIZATION
-- ===================================================================
-- Purpose: Add missing indexes for frequently queried columns
-- Target: Supabase PostgreSQL database
-- Execution: Run in Supabase SQL Editor
-- ===================================================================

-- Real-time location tracking optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_locations_user_timestamp 
  ON public.volunteer_locations(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_locations_recent_active 
  ON public.volunteer_locations(created_at DESC, user_id) 
  WHERE created_at > NOW() - INTERVAL '5 minutes';

-- Analytics query optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_assigned_to_status_created 
  ON public.incidents(assigned_to, status, created_at DESC) 
  WHERE assigned_to IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_reporter_created 
  ON public.incidents(reporter_id, created_at DESC);

-- Notification optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read_created 
  ON public.notifications(user_id, read_at, created_at DESC);

-- Volunteer profile optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_profiles_status_available 
  ON public.volunteer_profiles(status, is_available) 
  WHERE status = 'ACTIVE';

-- Incident updates for timeline
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incident_updates_incident_created 
  ON public.incident_updates(incident_id, created_at DESC);

-- Activity schedules optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_date_status 
  ON public.schedules(date, status);

-- SMS logs optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sms_logs_incident_created 
  ON public.sms_logs(incident_id, created_at DESC) 
  WHERE incident_id IS NOT NULL;

