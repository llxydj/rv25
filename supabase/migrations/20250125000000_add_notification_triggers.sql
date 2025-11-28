-- ========================================
-- NOTIFICATION AUTO-GENERATION TRIGGERS
-- ========================================
-- Purpose: Automatically create notifications for all relevant events
-- Benefits: 100% coverage, no silent failures, properly targeted notifications
--
-- IMPORTANT: These triggers work alongside the centralized NotificationService
-- - Triggers: For simple, atomic database events
-- - Service: For complex logic requiring external data or APIs

-- ========================================
-- FUNCTION: Notify admins on new incident
-- ========================================
CREATE OR REPLACE FUNCTION notify_admins_on_new_incident()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for ALL admin users
  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT 
    id,
    '🚨 New Incident Reported',
    NEW.incident_type || ' in ' || NEW.barangay,
    'incident_alert',
    jsonb_build_object(
      'incident_id', NEW.id, 
      'url', '/admin/incidents/' || NEW.id,
      'severity', NEW.severity
    )
  FROM users
  WHERE role = 'admin';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Fire on incident INSERT
CREATE TRIGGER trigger_notify_admins_on_new_incident
AFTER INSERT ON incidents
FOR EACH ROW
EXECUTE FUNCTION notify_admins_on_new_incident();

-- ========================================
-- FUNCTION: Notify barangay staff on new incident in their area
-- ========================================
CREATE OR REPLACE FUNCTION notify_barangay_on_new_incident()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for barangay staff in the affected barangay
  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT 
    id,
    '🚨 New Incident in Your Barangay',
    NEW.incident_type || ' reported in ' || NEW.barangay,
    'incident_alert',
    jsonb_build_object('incident_id', NEW.id, 'url', '/barangay/dashboard?incident=' || NEW.id)
  FROM users
  WHERE role = 'barangay' AND UPPER(barangay) = UPPER(NEW.barangay);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Fire on incident INSERT
CREATE TRIGGER trigger_notify_barangay_on_new_incident
AFTER INSERT ON incidents
FOR EACH ROW
EXECUTE FUNCTION notify_barangay_on_new_incident();

-- ========================================
-- FUNCTION: Notify volunteer on assignment
-- ========================================
CREATE OR REPLACE FUNCTION notify_volunteer_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify if assigned_to changed from NULL to a user
  -- OR if assigned_to changed from one user to another
  IF (NEW.assigned_to IS NOT NULL) AND 
     (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
    
    INSERT INTO notifications (user_id, title, body, type, data)
    VALUES (
      NEW.assigned_to,
      '📋 New Incident Assignment',
      'You have been assigned to a ' || NEW.incident_type || ' in ' || NEW.barangay,
      'assignment_alert',
      jsonb_build_object('incident_id', NEW.id, 'url', '/volunteer/incident/' || NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Fire on incident UPDATE
CREATE TRIGGER trigger_notify_volunteer_on_assignment
AFTER UPDATE ON incidents
FOR EACH ROW
WHEN (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to)
EXECUTE FUNCTION notify_volunteer_on_assignment();

-- ========================================
-- FUNCTION: Notify resident on status change
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Fire on incident UPDATE
CREATE TRIGGER trigger_notify_resident_on_status_change
AFTER UPDATE ON incidents
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION notify_resident_on_status_change();

-- ========================================
-- FUNCTION: Notify admins on escalation
-- ========================================
CREATE OR REPLACE FUNCTION notify_admins_on_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify if severity increased (escalation)
  IF NEW.severity < OLD.severity THEN
    
    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT 
      id,
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
    FROM users
    WHERE role = 'admin';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Fire on incident UPDATE
CREATE TRIGGER trigger_notify_admins_on_escalation
AFTER UPDATE ON incidents
FOR EACH ROW
WHEN (NEW.severity IS DISTINCT FROM OLD.severity)
EXECUTE FUNCTION notify_admins_on_escalation();

-- ========================================
-- INDEXES for Performance
-- ========================================
-- Ensure fast lookups when creating notifications
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_barangay ON users(barangay);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to ON incidents(assigned_to);

-- ========================================
-- COMMENTS for Documentation
-- ========================================
COMMENT ON FUNCTION notify_admins_on_new_incident IS 
  'Automatically notifies all admin users when a new incident is reported';

COMMENT ON FUNCTION notify_barangay_on_new_incident IS 
  'Automatically notifies barangay staff when an incident occurs in their jurisdiction';

COMMENT ON FUNCTION notify_volunteer_on_assignment IS 
  'Automatically notifies volunteer when they are assigned to an incident';

COMMENT ON FUNCTION notify_resident_on_status_change IS 
  'Automatically notifies resident when their incident status changes';

COMMENT ON FUNCTION notify_admins_on_escalation IS 
  'Automatically notifies admins when an incident is escalated in severity';
