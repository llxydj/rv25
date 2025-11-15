-- This migration ensures any other functions in the admin section that might be
-- referencing the old 'id' column instead of 'volunteer_user_id' are updated

-- Fix any potential functions in the admin interface that use the old column name
CREATE OR REPLACE FUNCTION admin_increment_resolved_incidents()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED' THEN
    -- Check if the incident has an assigned volunteer
    IF NEW.assigned_to IS NOT NULL THEN
      -- Update the volunteer's total resolved incidents count using volunteer_user_id
      UPDATE volunteer_profiles
      SET total_incidents_resolved = total_incidents_resolved + 1,
          updated_at = NOW()
      WHERE volunteer_user_id = NEW.assigned_to;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger for admin updates if it doesn't exist yet
DROP TRIGGER IF EXISTS admin_increment_resolved_incidents_count ON incidents;
CREATE TRIGGER admin_increment_resolved_incidents_count
AFTER UPDATE ON incidents
FOR EACH ROW
WHEN (NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED')
EXECUTE FUNCTION admin_increment_resolved_incidents();

-- Function for admin to update volunteer status efficiently
CREATE OR REPLACE FUNCTION admin_update_volunteer_status(
  volunteer_id UUID,
  new_status TEXT,
  admin_id UUID
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Update the volunteer profile using volunteer_user_id
  UPDATE volunteer_profiles
  SET 
    status = new_status::volunteer_status,
    last_status_change = NOW(),
    last_status_changed_by = admin_id,
    updated_at = NOW()
  WHERE volunteer_user_id = volunteer_id;
  
  -- Return success
  SELECT jsonb_build_object(
    'success', true,
    'message', 'Volunteer status updated successfully',
    'volunteer_id', volunteer_id,
    'new_status', new_status
  ) INTO result;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Return error
  RETURN jsonb_build_object(
    'success', false,
    'message', 'Error updating volunteer status: ' || SQLERRM,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql; 