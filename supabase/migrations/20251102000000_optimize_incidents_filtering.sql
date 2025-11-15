-- Migration: Optimize incidents filtering for admin panel
-- Purpose: Add indexes to improve performance of filtering by barangay, incident_type, priority, and date ranges
-- Date: 2025-11-02

-- Create indexes for common filter columns
CREATE INDEX IF NOT EXISTS idx_incidents_barangay_status 
  ON public.incidents(barangay, status);

CREATE INDEX IF NOT EXISTS idx_incidents_incident_type_status 
  ON public.incidents(incident_type, status);

CREATE INDEX IF NOT EXISTS idx_incidents_priority_status 
  ON public.incidents(priority, status);

CREATE INDEX IF NOT EXISTS idx_incidents_created_at_status 
  ON public.incidents(created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_incidents_severity_status 
  ON public.incidents(severity, status);

-- Composite indexes for multi-filter queries
CREATE INDEX IF NOT EXISTS idx_incidents_multi_filter 
  ON public.incidents(barangay, incident_type, priority, status);

CREATE INDEX IF NOT EXISTS idx_incidents_date_range 
  ON public.incidents(created_at DESC, updated_at DESC);

-- Index for offline incident detection (used in getAllIncidents)
CREATE INDEX IF NOT EXISTS idx_incident_updates_offline_notes 
  ON public.incident_updates USING gin (to_tsvector('english', notes))
  WHERE notes ILIKE '%Submitted while offline%';

-- Verify indexes were created
-- SELECT indexname FROM pg_indexes WHERE tablename = 'incidents' AND indexname LIKE 'idx_incidents_%';