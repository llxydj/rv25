-- ========================================
-- UPDATE NOTIFICATION FUNCTIONS WITH OTW & ARRIVED
-- ========================================
-- Run this in Supabase SQL Editor to update the functions
-- This improves messages to mention OTW and handle ARRIVED status
-- ========================================

-- Update admin notifications function
CREATE OR REPLACE FUNCTION notify_admins_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  status_message TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'ASSIGNED' THEN
        status_message := 'Incident has been assigned to a volunteer';
      WHEN 'RESPONDING' THEN
        status_message := 'Volunteer is on the way (OTW) to the incident';
      WHEN 'ARRIVED' THEN
        status_message := 'Volunteer has arrived at the incident location';
      WHEN 'RESOLVED' THEN
        status_message := 'Incident has been resolved';
      WHEN 'CANCELLED' THEN
        status_message := 'Incident has been cancelled';
      ELSE
        status_message := 'Incident status changed to ' || NEW.status;
    END CASE;
    
    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT 
      u.id,
      '📋 Incident Status Changed',
      NEW.incident_type || ' in ' || NEW.barangay || ': ' || status_message,
      'status_update',
      jsonb_build_object(
        'incident_id', NEW.id,
        'status', NEW.status,
        'url', '/admin/incidents/' || NEW.id
      )
    FROM users u
    LEFT JOIN notification_preferences np ON u.id = np.user_id
    WHERE u.role = 'admin'
      AND (np.push_enabled IS NULL OR np.push_enabled = TRUE)
      AND (np.incident_alerts IS NULL OR np.incident_alerts = TRUE);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update volunteer notifications function
CREATE OR REPLACE FUNCTION notify_volunteer_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  status_message TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.assigned_to IS NOT NULL THEN
    CASE NEW.status
      WHEN 'ASSIGNED' THEN
        status_message := 'Your assigned incident is now assigned';
      WHEN 'RESPONDING' THEN
        status_message := 'You are on the way (OTW) to the incident';
      WHEN 'ARRIVED' THEN
        status_message := 'You have arrived at the incident location';
      WHEN 'RESOLVED' THEN
        status_message := 'Your assigned incident has been resolved';
      WHEN 'CANCELLED' THEN
        status_message := 'Your assigned incident has been cancelled';
      ELSE
        status_message := 'Your assigned incident status changed to ' || NEW.status;
    END CASE;
    
    IF EXISTS (
      SELECT 1 
      FROM notification_preferences np
      WHERE np.user_id = NEW.assigned_to
        AND (np.push_enabled IS NULL OR np.push_enabled = TRUE)
        AND (np.status_updates IS NULL OR np.status_updates = TRUE)
    ) THEN
      INSERT INTO notifications (user_id, title, body, type, data)
      VALUES (
        NEW.assigned_to,
        '📋 Incident Status Update',
        NEW.incident_type || ' in ' || NEW.barangay || ': ' || status_message,
        'status_update',
        jsonb_build_object(
          'incident_id', NEW.id,
          'status', NEW.status,
          'url', '/volunteer/incident/' || NEW.id
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update resident notifications function (to match OTW/ARRIVED messages)
CREATE OR REPLACE FUNCTION notify_resident_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  status_message TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'ASSIGNED' THEN
        status_message := 'Your incident has been assigned to a volunteer';
      WHEN 'RESPONDING' THEN
        status_message := 'A volunteer is on the way (OTW) to your incident';
      WHEN 'ARRIVED' THEN
        status_message := 'A volunteer has arrived at your incident location';
      WHEN 'RESOLVED' THEN
        status_message := 'Your incident has been resolved';
      WHEN 'CANCELLED' THEN
        status_message := 'Your incident has been cancelled';
      ELSE
        status_message := 'Your incident status has been updated to ' || NEW.status;
    END CASE;
    
    IF EXISTS (
      SELECT 1 
      FROM notification_preferences np
      WHERE np.user_id = NEW.reporter_id
        AND (np.push_enabled IS NULL OR np.push_enabled = TRUE)
        AND (np.status_updates IS NULL OR np.status_updates = TRUE)
    ) THEN
      INSERT INTO notifications (user_id, title, body, type, data)
      VALUES (
        NEW.reporter_id,
        '📋 Incident Status Update',
        status_message,
        'status_update',
        jsonb_build_object(
          'incident_id', NEW.id, 
          'status', NEW.status,
          'url', '/resident/history?incident=' || NEW.id
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

