-- Update notification triggers to check user preferences before creating notifications

-- ========================================
-- FUNCTION: Notify admins on new incident (with preferences check)
-- ========================================
CREATE OR REPLACE FUNCTION notify_admins_on_new_incident()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for ALL admin users who have incident alerts enabled
  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT 
    u.id,
    '🚨 New Incident Reported',
    NEW.incident_type || ' in ' || NEW.barangay,
    'incident_alert',
    jsonb_build_object(
      'incident_id', NEW.id, 
      'url', '/admin/incidents/' || NEW.id,
      'severity', NEW.severity
    )
  FROM users u
  LEFT JOIN notification_preferences np ON u.id = np.user_id
  WHERE u.role = 'admin'
    AND (np.push_enabled IS NULL OR np.push_enabled = TRUE)
    AND (np.incident_alerts IS NULL OR np.incident_alerts = TRUE);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FUNCTION: Notify barangay staff on new incident in their area (with preferences check)
-- ========================================
CREATE OR REPLACE FUNCTION notify_barangay_on_new_incident()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for barangay staff in the affected barangay who have incident alerts enabled
  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT 
    u.id,
    '🚨 New Incident in Your Barangay',
    NEW.incident_type || ' reported in ' || NEW.barangay,
    'incident_alert',
    jsonb_build_object('incident_id', NEW.id, 'url', '/barangay/dashboard?incident=' || NEW.id)
  FROM users u
  LEFT JOIN notification_preferences np ON u.id = np.user_id
  WHERE u.role = 'barangay' 
    AND UPPER(u.barangay) = UPPER(NEW.barangay)
    AND (np.push_enabled IS NULL OR np.push_enabled = TRUE)
    AND (np.incident_alerts IS NULL OR np.incident_alerts = TRUE);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FUNCTION: Notify volunteer on assignment (with preferences check)
-- ========================================
CREATE OR REPLACE FUNCTION notify_volunteer_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify if assigned_to changed from NULL to a user
  -- OR if assigned_to changed from one user to another
  IF (NEW.assigned_to IS NOT NULL) AND 
     (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
    
    -- Check if the volunteer has assignment alerts enabled
    IF EXISTS (
      SELECT 1 
      FROM notification_preferences np
      WHERE np.user_id = NEW.assigned_to
        AND (np.push_enabled IS NULL OR np.push_enabled = TRUE)
        AND (np.incident_alerts IS NULL OR np.incident_alerts = TRUE)
    ) THEN
      INSERT INTO notifications (user_id, title, body, type, data)
      VALUES (
        NEW.assigned_to,
        '📋 New Incident Assignment',
        'You have been assigned to a ' || NEW.incident_type || ' in ' || NEW.barangay,
        'assignment_alert',
        jsonb_build_object('incident_id', NEW.id, 'url', '/volunteer/incident/' || NEW.id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FUNCTION: Notify resident on status change (with preferences check)
-- ========================================
CREATE OR REPLACE FUNCTION notify_resident_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  status_message TEXT;
BEGIN
  -- Only notify if status actually changed
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    
    -- Determine message based on new status
    CASE NEW.status
      WHEN 'ASSIGNED' THEN
        status_message := 'Your incident has been assigned to a volunteer';
      WHEN 'RESPONDING' THEN
        status_message := 'A volunteer is responding to your incident';
      WHEN 'RESOLVED' THEN
        status_message := 'Your incident has been resolved';
      WHEN 'CANCELLED' THEN
        status_message := 'Your incident has been cancelled';
      ELSE
        status_message := 'Your incident status has been updated to ' || NEW.status;
    END CASE;
    
    -- Check if the resident has status updates enabled
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

-- ========================================
-- FUNCTION: Notify admins on escalation (with preferences check)
-- ========================================
CREATE OR REPLACE FUNCTION notify_admins_on_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify if severity increased (escalation) and admins have escalation alerts enabled
  IF NEW.severity < OLD.severity THEN
    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT 
      u.id,
      '⚠️ Incident Escalated',
      NEW.incident_type || ' in ' || NEW.barangay || ' has been escalated to ' || 
      CASE NEW.severity
        WHEN 1 THEN 'CRITICAL'
        WHEN 2 THEN 'HIGH'
        WHEN 3 THEN 'MODERATE'
        ELSE 'LOW'
      END,
      'escalation_alert',
      jsonb_build_object('incident_id', NEW.id, 'url', '/admin/incidents/' || NEW.id)
    FROM users u
    LEFT JOIN notification_preferences np ON u.id = np.user_id
    WHERE u.role = 'admin'
      AND (np.push_enabled IS NULL OR np.push_enabled = TRUE)
      AND (np.escalation_alerts IS NULL OR np.escalation_alerts = TRUE);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;