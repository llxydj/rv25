-- Migration: Add overdue incidents cron function
-- Purpose: Create a PostgreSQL function that can be scheduled to run periodically
-- Date: 2025-11-03

-- Function to automatically check for overdue incidents and send notifications
CREATE OR REPLACE FUNCTION check_overdue_incidents()
RETURNS void AS $$
DECLARE
  incident_record RECORD;
  admin_record RECORD;
  volunteer_record RECORD;
  minutes_overdue INTEGER;
  notification_title TEXT;
  notification_body TEXT;
  critical_notification_title TEXT;
  critical_notification_body TEXT;
BEGIN
  -- Loop through all overdue incidents
  FOR incident_record IN 
    SELECT 
      id,
      incident_type,
      barangay,
      status,
      created_at,
      assigned_to,
      priority
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
    
    -- Special handling for priority 1 incidents overdue by 5+ minutes
    IF incident_record.priority = 1 AND minutes_overdue >= 5 THEN
      critical_notification_title := '🚨 CRITICAL: 5-Minute Response Time Exceeded!';
      critical_notification_body := format(
        '🚨 CRITICAL INCIDENT #%s (%s) in %s requires IMMEDIATE attention! Response time exceeded 5 minutes (%s minutes overdue). Please assign volunteer immediately!',
        LEFT(incident_record.id::TEXT, 8),
        incident_record.incident_type,
        incident_record.barangay,
        minutes_overdue
      );
      
      -- Send critical alerts to all admins
      FOR admin_record IN 
        SELECT id FROM users WHERE role = 'admin'
      LOOP
        -- Insert critical notification for admin
        INSERT INTO notifications (
          user_id,
          title,
          body,
          type,
          data
        ) VALUES (
          admin_record.id,
          critical_notification_title,
          critical_notification_body,
          'SYSTEM_ALERT',
          jsonb_build_object(
            'incident_id', incident_record.id,
            'type', 'overdue_incident',
            'priority', incident_record.priority,
            'minutes_overdue', minutes_overdue
          )
        );
      END LOOP;
    ELSE
      -- Send regular notifications to all admins
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
    END IF;
    
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
-- 4. The check-overdue-incidents.ts script in the scripts directory