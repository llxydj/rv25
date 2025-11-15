-- Migration: Add overdue incidents cron function
-- Purpose: Create a PostgreSQL function that can be scheduled to run periodically
-- Date: 2025-11-03

-- Function to automatically check for overdue incidents and send notifications
CREATE OR REPLACE FUNCTION check_overdue_incidents()
RETURNS void AS $$
DECLARE
  incident_record RECORD;
  admin_record RECORD;
  minutes_overdue INTEGER;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Loop through all overdue incidents
  FOR incident_record IN 
    SELECT 
      id,
      incident_type,
      barangay,
      status,
      created_at,
      assigned_to
    FROM incidents 
    WHERE is_overdue = TRUE
  LOOP
    -- Calculate minutes overdue
    minutes_overdue := EXTRACT(EPOCH FROM (NOW() - incident_record.created_at))/60;
    
    -- Create notification title and body
    notification_title := 'Overdue Incident Alert';
    notification_body := format(
      'Incident #%s (%s) in %s has been overdue for %s minutes.',
      LEFT(incident_record.id::TEXT, 8),
      incident_record.incident_type,
      incident_record.barangay,
      minutes_overdue
    );
    
    -- Send notifications to all admins
    FOR admin_record IN 
      SELECT id FROM users WHERE role = 'admin'
    LOOP
      -- Insert notification for admin
      INSERT INTO notifications (
        user_id,
        title,
        body,
        type,
        data
      ) VALUES (
        admin_record.id,
        notification_title,
        notification_body,
        'SYSTEM_ALERT',
        jsonb_build_object(
          'incident_id', incident_record.id,
          'type', 'overdue_incident'
        )
      );
    END LOOP;
    
    -- If incident is assigned to a volunteer, also notify them
    IF incident_record.assigned_to IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        title,
        body,
        type,
        data
      ) VALUES (
        incident_record.assigned_to,
        'Overdue Incident Alert',
        format(
          'Incident #%s (%s) in %s assigned to you has been overdue for %s minutes.',
          LEFT(incident_record.id::TEXT, 8),
          incident_record.incident_type,
          incident_record.barangay,
          minutes_overdue
        ),
        'SYSTEM_ALERT',
        jsonb_build_object(
          'incident_id', incident_record.id,
          'type', 'overdue_incident'
        )
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- To schedule this function to run every 5 minutes, you would typically use:
-- SELECT cron.schedule('check-overdue-incidents', '*/5 * * * *', $$SELECT check_overdue_incidents();$$);
-- However, since we're using Supabase, we'll use the Supabase cron extension syntax:
-- SELECT add_job('check-overdue-incidents', '5 minutes', $$SELECT check_overdue_incidents();$$);

-- For environments without cron extension, this function can be called via:
-- 1. A scheduled API endpoint
-- 2. A serverless function triggered by a scheduler
-- 3. A background worker process