-- Migration: Add incident response time check function
-- Purpose: Identify incidents that haven't been updated within 5 minutes
-- Date: 2025-11-03

-- Function to check if an incident is overdue (no status update within 5 minutes)
CREATE OR REPLACE FUNCTION is_incident_overdue(incident_row incidents)
RETURNS BOOLEAN AS $$
BEGIN
  -- If incident is already resolved or cancelled, it's not overdue
  IF incident_row.status IN ('RESOLVED', 'CANCELLED') THEN
    RETURN FALSE;
  END IF;
  
  -- If incident is pending and was created more than 5 minutes ago, it's overdue
  IF incident_row.status = 'PENDING' THEN
    RETURN incident_row.created_at < NOW() - INTERVAL '5 minutes';
  END IF;
  
  -- For assigned/responding incidents, check if last update was more than 5 minutes ago
  -- Get the latest update time from incident_updates table
  DECLARE
    latest_update TIMESTAMP WITH TIME ZONE;
  BEGIN
    SELECT MAX(created_at) INTO latest_update
    FROM incident_updates
    WHERE incident_id = incident_row.id;
    
    -- If there are no updates, use the incident creation time
    IF latest_update IS NULL THEN
      latest_update := incident_row.created_at;
    END IF;
    
    -- Check if more than 5 minutes have passed since last update
    RETURN latest_update < NOW() - INTERVAL '5 minutes';
  END;
END;
$$ LANGUAGE plpgsql;

-- Add a computed column to incidents table to show if incident is overdue
ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN GENERATED ALWAYS AS (is_incident_overdue(incidents.*)) STORED;

-- Create index for better performance on overdue incidents
CREATE INDEX IF NOT EXISTS idx_incidents_overdue ON incidents(is_overdue) WHERE is_overdue = TRUE;

-- Create a view for easy querying of overdue incidents
CREATE OR REPLACE VIEW overdue_incidents AS
SELECT 
  id,
  incident_type,
  description,
  barangay,
  status,
  priority,
  created_at,
  assigned_to,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 AS minutes_since_creation,
  CASE 
    WHEN status = 'PENDING' THEN EXTRACT(EPOCH FROM (NOW() - created_at))/60
    ELSE (
      SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/60
      FROM incident_updates
      WHERE incident_id = incidents.id
    )
  END AS minutes_since_last_update
FROM incidents
WHERE is_overdue = TRUE
ORDER BY created_at ASC;