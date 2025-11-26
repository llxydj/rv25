-- ===================================================================
-- RVOIS DATABASE PERFORMANCE INDEXES - OPTIMIZED VERSION
-- ===================================================================
-- Purpose: Create comprehensive indexes to optimize database performance
-- Target: Supabase PostgreSQL database
-- Execution: Run in Supabase SQL Editor
-- 
-- IMPORTANT NOTES:
-- - Uses CREATE INDEX CONCURRENTLY to avoid table locks
-- - Monitor index usage with provided utility functions
-- - Review and drop unused indexes after 30 days
-- - Estimated execution time: 10-30 minutes depending on data volume
-- ===================================================================

-- ===================================================================
-- PRE-EXECUTION CHECKS
-- ===================================================================

DO $$
BEGIN
  RAISE NOTICE 'Starting RVOIS Performance Index Creation';
  RAISE NOTICE 'Database: %', current_database();
  RAISE NOTICE 'User: %', current_user;
  RAISE NOTICE 'Timestamp: %', now();
END $$;

-- ===================================================================
-- PART 1: FOREIGN KEY INDEXES (Critical for JOIN performance)
-- ===================================================================
-- These indexes dramatically improve JOIN operations between tables
-- Priority: CRITICAL - Create these first
-- ===================================================================

-- announcements table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_announcements_created_by 
  ON public.announcements(created_by);

-- call_logs table (high-frequency joins)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_user_id 
  ON public.call_logs(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_incident_id 
  ON public.call_logs(incident_id);

-- incident_updates table (frequent updates tracking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incident_updates_incident_id 
  ON public.incident_updates(incident_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incident_updates_updated_by 
  ON public.incident_updates(updated_by);

-- incidents table (HIGHEST PRIORITY - most queried table)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_reporter_id 
  ON public.incidents(reporter_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_assigned_to 
  ON public.incidents(assigned_to);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_user_id 
  ON public.incidents(user_id);

-- location_preferences table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_preferences_user_id 
  ON public.location_preferences(user_id);

-- location_tracking table (real-time features require fast lookups)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_tracking_user_id 
  ON public.location_tracking(user_id);

-- notification_preferences table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_preferences_user_id 
  ON public.notification_preferences(user_id);

-- notifications table (high read frequency)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id 
  ON public.notifications(user_id);

-- push_subscriptions table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_push_subscriptions_user_id 
  ON public.push_subscriptions(user_id);

-- reports table (multiple foreign key relationships)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_incident_id 
  ON public.reports(incident_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_created_by 
  ON public.reports(created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_reviewed_by 
  ON public.reports(reviewed_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_user_id 
  ON public.reports(user_id);

-- scheduledactivities table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduledactivities_volunteer_user_id 
  ON public.scheduledactivities(volunteer_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduledactivities_created_by 
  ON public.scheduledactivities(created_by);

-- schedules table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_volunteer_id 
  ON public.schedules(volunteer_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_created_by 
  ON public.schedules(created_by);

-- training_evaluations table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_evaluations_training_id 
  ON public.training_evaluations(training_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_evaluations_user_id 
  ON public.training_evaluations(user_id);

-- trainings table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trainings_created_by 
  ON public.trainings(created_by);

-- volunteer_information table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_information_user_id 
  ON public.volunteer_information(user_id);

-- volunteer_profiles table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_profiles_admin_user_id 
  ON public.volunteer_profiles(admin_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_profiles_last_status_changed_by 
  ON public.volunteer_profiles(last_status_changed_by);

-- volunteeractivities table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteeractivities_volunteer_user_id 
  ON public.volunteeractivities(volunteer_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteeractivities_incident_id 
  ON public.volunteeractivities(incident_id);

-- ===================================================================
-- PART 2: STATUS & FILTER INDEXES (WHERE clause optimization)
-- ===================================================================
-- These indexes speed up filtered queries on status, type, and flags
-- Priority: HIGH - Common in dashboards and reports
-- ===================================================================

-- incidents - Status filtering (admin dashboard, volunteer panel)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_status 
  ON public.incidents(status);

-- incidents - Barangay filtering (barangay officials panel)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_barangay 
  ON public.incidents(barangay);

-- incidents - Priority filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_priority 
  ON public.incidents(priority);

-- incidents - Severity filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_severity 
  ON public.incidents(severity);

-- incidents - Incident type search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_incident_type 
  ON public.incidents(incident_type);

-- reports - Status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_status 
  ON public.reports(status);

-- reports - Report type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_report_type 
  ON public.reports(report_type);

-- volunteer_profiles - Status filtering (active volunteers)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_profiles_status 
  ON public.volunteer_profiles(status);

-- volunteer_profiles - Availability filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_profiles_is_available 
  ON public.volunteer_profiles(is_available);

-- volunteer_information - Active filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_information_is_active 
  ON public.volunteer_information(is_active);

-- volunteer_information - Verified filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_information_verified 
  ON public.volunteer_information(verified);

-- call_logs - Call type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_call_type 
  ON public.call_logs(call_type);

-- call_logs - Status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_status 
  ON public.call_logs(status);

-- emergency_contacts - Type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emergency_contacts_type 
  ON public.emergency_contacts(type);

-- emergency_contacts - Active filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emergency_contacts_is_active 
  ON public.emergency_contacts(is_active);

-- notifications - Type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type 
  ON public.notifications(type);

-- scheduledactivities - Acceptance filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduledactivities_is_accepted 
  ON public.scheduledactivities(is_accepted);

-- volunteeractivities - Participation filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteeractivities_participated 
  ON public.volunteeractivities(participated);

-- volunteeractivities - Status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteeractivities_status 
  ON public.volunteeractivities(status);

-- users - Role filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role 
  ON public.users(role);

-- users - Email search (unique lookups)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
  ON public.users(email);

-- announcements - Type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_announcements_type 
  ON public.announcements(type);

-- announcements - Priority filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_announcements_priority 
  ON public.announcements(priority);

-- ===================================================================
-- PART 3: TIMESTAMP INDEXES (ORDER BY, recent data queries)
-- ===================================================================
-- These indexes optimize sorting and time-range queries
-- Priority: HIGH - Critical for dashboards showing recent activity
-- ===================================================================

-- incidents - Recent incidents (dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_created_at_desc 
  ON public.incidents(created_at DESC);

-- incidents - Recently updated
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_updated_at_desc 
  ON public.incidents(updated_at DESC);

-- incidents - Assignment timestamp (partial index for efficiency)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_assigned_at 
  ON public.incidents(assigned_at DESC) 
  WHERE assigned_at IS NOT NULL;

-- incidents - Resolution timestamp (partial index for efficiency)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_resolved_at 
  ON public.incidents(resolved_at DESC) 
  WHERE resolved_at IS NOT NULL;

-- location_tracking - Recent locations (real-time tracking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_tracking_timestamp_desc 
  ON public.location_tracking(timestamp DESC);

-- location_tracking - Created timestamp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_tracking_created_at_desc 
  ON public.location_tracking(created_at DESC);

-- notifications - Recent notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_sent_at_desc 
  ON public.notifications(sent_at DESC);

-- notifications - Created timestamp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at_desc 
  ON public.notifications(created_at DESC);

-- call_logs - Recent calls
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_created_at_desc 
  ON public.call_logs(created_at DESC);

-- reports - Recent reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_created_at_desc 
  ON public.reports(created_at DESC);

-- reports - Review timestamp (partial index for efficiency)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_reviewed_at 
  ON public.reports(reviewed_at DESC) 
  WHERE reviewed_at IS NOT NULL;

-- scheduledactivities - Upcoming activities
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduledactivities_date 
  ON public.scheduledactivities(date);

-- schedules - Start time
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_start_time 
  ON public.schedules(start_time);

-- trainings - Start time
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trainings_start_at 
  ON public.trainings(start_at);

-- users - Last active
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_active 
  ON public.users(last_active DESC);

-- volunteer_profiles - Last active
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_profiles_last_active_at 
  ON public.volunteer_profiles(last_active_at DESC);

-- volunteer_information - Last activity (partial index for efficiency)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_information_last_activity 
  ON public.volunteer_information(last_activity DESC) 
  WHERE last_activity IS NOT NULL;

-- ===================================================================
-- PART 4: COMPOSITE INDEXES (Multi-column queries)
-- ===================================================================
-- These indexes optimize queries with multiple WHERE conditions
-- Priority: HIGH - Dramatically improve complex query performance
-- Note: Column order matters - most selective column first
-- ===================================================================

-- incidents - Status + Created (Dashboard: pending incidents by date)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_status_created_at 
  ON public.incidents(status, created_at DESC);

-- incidents - Barangay + Status (Barangay officials: area incidents)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_barangay_status 
  ON public.incidents(barangay, status);

-- incidents - Barangay + Created (Barangay: recent area incidents)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_barangay_created_at 
  ON public.incidents(barangay, created_at DESC);

-- incidents - Assigned to + Status (Volunteer: my assigned incidents)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_assigned_to_status 
  ON public.incidents(assigned_to, status) 
  WHERE assigned_to IS NOT NULL;

-- incidents - Reporter + Created (Resident: my incident reports)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_reporter_id_created_at 
  ON public.incidents(reporter_id, created_at DESC) 
  WHERE reporter_id IS NOT NULL;

-- location_tracking - User + Timestamp (User location history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_tracking_user_timestamp 
  ON public.location_tracking(user_id, timestamp DESC);

-- notifications - User + Unread (Unread notifications per user)
-- Note: Query should use WHERE read_at IS NULL for this index to be used
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread 
  ON public.notifications(user_id, sent_at DESC) 
  WHERE read_at IS NULL;

-- notifications - User + Type + Sent time (Filter by notification type)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_type_sent 
  ON public.notifications(user_id, type, sent_at DESC);

-- volunteer_profiles - Active + Available (Find available volunteers)
-- Note: Query must use exact values for this partial index to be used
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_profiles_status_available 
  ON public.volunteer_profiles(status, is_available) 
  WHERE status = 'ACTIVE' AND is_available = true;

-- volunteer_profiles - Active + Last active (Active volunteers by recency)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_profiles_status_last_active 
  ON public.volunteer_profiles(status, last_active_at DESC) 
  WHERE status = 'ACTIVE';

-- volunteeractivities - Volunteer + Status (My activities by status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteeractivities_volunteer_status 
  ON public.volunteeractivities(volunteer_user_id, status);

-- reports - Status + Created (Pending reports by date)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_status_created 
  ON public.reports(status, created_at DESC);

-- scheduledactivities - Volunteer + Date (My schedule)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduledactivities_volunteer_date 
  ON public.scheduledactivities(volunteer_user_id, date);

-- scheduledactivities - Date + Accepted (Upcoming accepted activities)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduledactivities_date_accepted 
  ON public.scheduledactivities(date, is_accepted) 
  WHERE is_accepted = true;

-- call_logs - User + Created (My call history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_user_created 
  ON public.call_logs(user_id, created_at DESC);

-- call_logs - Incident + Created (Incident call logs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_incident_created 
  ON public.call_logs(incident_id, created_at DESC) 
  WHERE incident_id IS NOT NULL;

-- ===================================================================
-- PART 5: GEOSPATIAL INDEXES (Location-based queries)
-- ===================================================================
-- These indexes optimize proximity searches and map queries
-- Priority: MEDIUM - Important for location features
-- Note: Requires PostGIS extension for GIST spatial indexes
-- ===================================================================

-- Check if PostGIS is available before creating spatial indexes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'postgis'
  ) THEN
    -- incidents - Geospatial index for radius/proximity queries
    EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_location 
      ON public.incidents USING gist (
        ll_to_earth(location_lat, location_lng)
      )';
    RAISE NOTICE 'PostGIS spatial index created for incidents';
  ELSE
    RAISE NOTICE 'PostGIS not available - skipping spatial GIST index';
    RAISE NOTICE 'Using coordinate-based indexes instead';
  END IF;
END $$;

-- Alternative: Coordinate indexes for bounding box queries
-- These work without PostGIS and are efficient for rectangular area searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_lat 
  ON public.incidents(location_lat) 
  WHERE location_lat IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_lng 
  ON public.incidents(location_lng) 
  WHERE location_lng IS NOT NULL;

-- Composite coordinate index for precise location lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_coordinates 
  ON public.incidents(location_lat, location_lng) 
  WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

-- location_tracking - Coordinate composite index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_tracking_coordinates 
  ON public.location_tracking(latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ===================================================================
-- PART 6: TEXT SEARCH INDEXES (Full-text search optimization)
-- ===================================================================
-- These GIN indexes dramatically improve text search performance
-- Priority: MEDIUM - Important for search features
-- Note: Uses PostgreSQL's built-in full-text search
-- ===================================================================

-- incidents - Description full-text search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_description_gin 
  ON public.incidents USING gin (
    to_tsvector('english', COALESCE(description, ''))
  );

-- incidents - Address full-text search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_address_gin 
  ON public.incidents USING gin (
    to_tsvector('english', COALESCE(address, ''))
  );

-- users - Full name search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_name_gin 
  ON public.users USING gin (
    to_tsvector('english', 
      COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
    )
  );

-- announcements - Title full-text search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_announcements_title_gin 
  ON public.announcements USING gin (
    to_tsvector('english', COALESCE(title, ''))
  );

-- ===================================================================
-- PART 7: JSONB & ARRAY INDEXES (Structured data optimization)
-- ===================================================================
-- These GIN indexes optimize queries on JSONB and array columns
-- Priority: MEDIUM - Useful for filtering on complex data types
-- ===================================================================

-- volunteer_profiles - Skills array search (e.g., WHERE 'First Aid' = ANY(skills))
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_profiles_skills_gin 
  ON public.volunteer_profiles USING gin (skills);

-- volunteer_profiles - Availability array search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_profiles_availability_gin 
  ON public.volunteer_profiles USING gin (availability);

-- volunteer_profiles - Assigned barangays array search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_profiles_assigned_barangays_gin 
  ON public.volunteer_profiles USING gin (assigned_barangays);

-- notifications - JSONB data search (e.g., WHERE data @> '{"type":"alert"}')
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_data_gin 
  ON public.notifications USING gin (data);

-- push_subscriptions - Subscription JSONB
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_push_subscriptions_subscription_gin 
  ON public.push_subscriptions USING gin (subscription);

-- barangays - Boundaries JSONB (for geofencing queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_barangays_boundaries_gin 
  ON public.barangays USING gin (boundaries);

-- ===================================================================
-- MONITORING & MAINTENANCE UTILITIES
-- ===================================================================
-- These functions help track index usage and identify optimization opportunities
-- Run these periodically to ensure indexes are being used effectively
-- ===================================================================

-- Function: Check index usage statistics
-- Usage: SELECT * FROM rvois_check_index_usage();
-- Purpose: Identify unused indexes that can be dropped
CREATE OR REPLACE FUNCTION rvois_check_index_usage()
RETURNS TABLE(
  schemaname text,
  tablename text,
  indexname text,
  idx_scan bigint,
  idx_tup_read bigint,
  idx_tup_fetch bigint,
  index_size text,
  usage_note text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.schemaname::text,
    s.tablename::text,
    s.indexrelname::text,
    s.idx_scan,
    s.idx_tup_read,
    s.idx_tup_fetch,
    pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size,
    CASE 
      WHEN s.idx_scan = 0 THEN '⚠️ UNUSED - Consider dropping'
      WHEN s.idx_scan < 100 THEN '⚡ Low usage'
      WHEN s.idx_scan < 1000 THEN '✓ Moderate usage'
      ELSE '✓✓ High usage'
    END::text as usage_note
  FROM pg_stat_user_indexes s
  WHERE s.schemaname = 'public'
  ORDER BY s.idx_scan ASC, pg_relation_size(s.indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION rvois_check_index_usage() IS 
'Check how often each index is used. Run monthly to identify unused indexes.';

-- Function: Find missing indexes on foreign keys
-- Usage: SELECT * FROM rvois_find_missing_fk_indexes();
-- Purpose: Ensure all foreign keys have supporting indexes
CREATE OR REPLACE FUNCTION rvois_find_missing_fk_indexes()
RETURNS TABLE(
  table_name text,
  column_name text,
  constraint_name text,
  referenced_table text,
  recommendation text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.table_name::text,
    kcu.column_name::text,
    tc.constraint_name::text,
    ccu.table_name::text AS referenced_table,
    ('CREATE INDEX idx_' || tc.table_name || '_' || kcu.column_name || 
     ' ON public.' || tc.table_name || '(' || kcu.column_name || ');')::text AS recommendation
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = tc.table_name
        AND indexdef LIKE '%' || kcu.column_name || '%'
    )
  ORDER BY tc.table_name, kcu.column_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION rvois_find_missing_fk_indexes() IS 
'Identify foreign keys without indexes. All foreign keys should have indexes for optimal JOIN performance.';

-- Function: Get table and index size statistics
-- Usage: SELECT * FROM rvois_get_table_sizes();
-- Purpose: Monitor database growth and index overhead
CREATE OR REPLACE FUNCTION rvois_get_table_sizes()
RETURNS TABLE(
  table_name text,
  row_count bigint,
  table_size text,
  indexes_size text,
  total_size text,
  index_ratio text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    s.n_live_tup,
    pg_size_pretty(pg_table_size(t.schemaname||'.'||t.tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(t.schemaname||'.'||t.tablename)) AS indexes_size,
    pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.tablename)) AS total_size,
    CASE 
      WHEN pg_table_size(t.schemaname||'.'||t.tablename) > 0 THEN
        ROUND(
          (pg_indexes_size(t.schemaname||'.'||t.tablename)::numeric / 
           pg_table_size(t.schemaname||'.'||t.tablename)::numeric) * 100, 
          2
        )::text || '%'
      ELSE '0%'
    END::text AS index_ratio
  FROM pg_tables t
  LEFT JOIN pg_stat_user_tables s ON t.tablename = s.relname AND t.schemaname = s.schemaname
  WHERE t.schemaname = 'public'
  ORDER BY pg_total_relation_size(t.schemaname||'.'||t.tablename) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION rvois_get_table_sizes() IS 
'Show table sizes, index sizes, and index overhead. Index ratio >100% may indicate over-indexing.';

-- Function: Get slow query suggestions
-- Usage: SELECT * FROM rvois_slow_query_suggestions();
-- Purpose: Analyze which queries might benefit from additional indexes
CREATE OR REPLACE FUNCTION rvois_slow_query_suggestions()
RETURNS TABLE(
  query_text text,
  calls bigint,
  total_time_ms numeric,
  avg_time_ms numeric,
  rows_per_call bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    LEFT(query, 100)::text as query_text,
    calls,
    ROUND((total_exec_time)::numeric, 2) as total_time_ms,
    ROUND((mean_exec_time)::numeric, 2) as avg_time_ms,
    CASE WHEN calls > 0 THEN (rows / calls) ELSE 0 END as rows_per_call
  FROM pg_stat_statements
  WHERE query NOT LIKE '%pg_stat_statements%'
    AND query NOT LIKE '%COMMIT%'
    AND query NOT LIKE '%BEGIN%'
  ORDER BY mean_exec_time DESC
  LIMIT 20;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_stat_statements extension not enabled. Enable it for query analysis.';
    RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION rvois_slow_query_suggestions() IS 
'Requires pg_stat_statements extension. Shows slowest queries for optimization.';

-- ===================================================================
-- POST-EXECUTION SUMMARY & VERIFICATION
-- ===================================================================

DO $$
DECLARE
  v_index_count INTEGER;
  v_total_size TEXT;
  v_avg_size TEXT;
BEGIN
  -- Count indexes created
  SELECT COUNT(*), 
         pg_size_pretty(SUM(pg_relation_size(indexrelid))),
         pg_size_pretty(AVG(pg_relation_size(indexrelid)))
  INTO v_index_count, v_total_size, v_avg_size
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
    AND indexrelname LIKE 'idx_%';

  -- Log to system_logs if table exists
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'system_logs' 
    AND schemaname = 'public'
  ) THEN
    INSERT INTO public.system_logs (action, details, created_by)
    VALUES (
      'rvois_performance_indexes_created',
      jsonb_build_object(
        'index_count', v_index_count,
        'total_size', v_total_size,
        'average_size', v_avg_size,
        'timestamp', now()
      ),
      'system'
    );
  END IF;

  -- Display summary
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'INDEX CREATION COMPLETE';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Total indexes created: %', v_index_count;
  RAISE NOTICE 'Total index size: %', v_total_size;
  RAISE NOTICE 'Average index size: %', v_avg_size;
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Monitor index usage: SELECT * FROM rvois_check_index_usage();';
  RAISE NOTICE '2. Check table sizes: SELECT * FROM rvois_get_table_sizes();';
  RAISE NOTICE '3. Find missing FK indexes: SELECT * FROM rvois_find_missing_fk_indexes();';
  RAISE NOTICE '4. Review slow queries: SELECT * FROM rvois_slow_query_suggestions();';
  RAISE NOTICE '';
  RAISE NOTICE 'Schedule monthly reviews to drop unused indexes.';
  RAISE NOTICE '==================================================';
END $$;

-- Create a view for quick index health monitoring
CREATE OR REPLACE VIEW rvois_index_health AS
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

COMMENT ON VIEW rvois_index_health IS 
'Quick dashboard view for monitoring index health and usage patterns.';

-- ===================================================================
-- MAINTENANCE RECOMMENDATIONS
-- ===================================================================
-- 
-- WEEKLY:
--