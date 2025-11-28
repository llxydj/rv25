-- ========================================
-- ADD MISSING STATUS CHANGE NOTIFICATIONS
-- ========================================
-- Purpose: Notify admins and volunteers on incident status changes
-- Date: 2025-01-28
--
-- This migration adds notifications for:
-- 1. Admins: Get notified on ALL status changes
-- 2. Volunteers: Get notified on status changes of their assigned incidents
-- ========================================

-- ========================================
-- FUNCTION: Notify admins on status change
-- ========================================
CREATE OR REPLACE FUNCTION notify_admins_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  status_message TEXT;
BEGIN
  -- Only notify if status actually changed
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    
    -- Determine message based on new status
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
    
    -- Create notification for ALL admin users who have incident alerts enabled
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

-- Trigger: Fire on incident UPDATE
CREATE TRIGGER trigger_notify_admins_on_status_change
AFTER UPDATE ON incidents
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION notify_admins_on_status_change();

-- ========================================
-- FUNCTION: Notify assigned volunteer on status change
-- ========================================
CREATE OR REPLACE FUNCTION notify_volunteer_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  status_message TEXT;
BEGIN
  -- Only notify if status changed AND volunteer is assigned
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.assigned_to IS NOT NULL THEN
    
    -- Determine message based on new status
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
    
    -- Check if the volunteer has status updates enabled
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

-- Trigger: Fire on incident UPDATE
CREATE TRIGGER trigger_notify_volunteer_on_status_change
AFTER UPDATE ON incidents
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status AND NEW.assigned_to IS NOT NULL)
EXECUTE FUNCTION notify_volunteer_on_status_change();

-- ========================================
-- COMMENTS for Documentation
-- ========================================
COMMENT ON FUNCTION notify_admins_on_status_change IS 
  'Automatically notifies all admin users when an incident status changes';

COMMENT ON FUNCTION notify_volunteer_on_status_change IS 
  'Automatically notifies assigned volunteer when their incident status changes';

