-- ===================================================================
-- MATERIALIZED VIEWS FOR ANALYTICS OPTIMIZATION
-- ===================================================================
-- Purpose: Pre-compute heavy analytics queries to reduce database load
-- Target: Supabase PostgreSQL database
-- Execution: Run in Supabase SQL Editor
-- Refresh: Set up cron job or trigger to refresh periodically
-- ===================================================================

-- Materialized view for volunteer analytics summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_volunteer_analytics_summary AS
SELECT 
  vp.volunteer_user_id,
  u.first_name,
  u.last_name,
  COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'RESOLVED') as total_resolved,
  COUNT(DISTINCT i.id) as total_incidents,
  AVG(EXTRACT(EPOCH FROM (i.resolved_at - i.assigned_at)) / 60) FILTER (WHERE i.resolved_at IS NOT NULL AND i.assigned_at IS NOT NULL) as avg_response_time_minutes,
  COUNT(DISTINCT i.id) FILTER (WHERE i.created_at > NOW() - INTERVAL '30 days') as incidents_last_30_days
FROM volunteer_profiles vp
JOIN users u ON u.id = vp.volunteer_user_id
LEFT JOIN incidents i ON i.assigned_to = vp.volunteer_user_id
WHERE vp.status = 'ACTIVE'
GROUP BY vp.volunteer_user_id, u.first_name, u.last_name;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_volunteer_analytics_user_id 
  ON mv_volunteer_analytics_summary(volunteer_user_id);

-- Materialized view for incident statistics by barangay
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_incident_stats_by_barangay AS
SELECT 
  barangay,
  COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
  COUNT(*) FILTER (WHERE status = 'ASSIGNED') as assigned_count,
  COUNT(*) FILTER (WHERE status = 'RESPONDING') as responding_count,
  COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7_days,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30_days,
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_hours
FROM incidents
WHERE barangay IS NOT NULL
GROUP BY barangay;

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_incident_stats_barangay 
  ON mv_incident_stats_by_barangay(barangay);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_volunteer_analytics_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_incident_stats_by_barangay;
END;
$$ LANGUAGE plpgsql;

-- Comment on views
COMMENT ON MATERIALIZED VIEW mv_volunteer_analytics_summary IS 'Pre-computed volunteer analytics to reduce query load. Refresh every 5-15 minutes.';
COMMENT ON MATERIALIZED VIEW mv_incident_stats_by_barangay IS 'Pre-computed incident statistics by barangay. Refresh every 5-15 minutes.';

