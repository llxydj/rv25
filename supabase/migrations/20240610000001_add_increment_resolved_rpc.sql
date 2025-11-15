-- Create a function to safely increment a volunteer's resolved count
CREATE OR REPLACE FUNCTION increment_volunteer_resolved_count(volunteer_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count INTEGER;
  new_count INTEGER;
BEGIN
  -- Get the current count with error handling
  SELECT COALESCE(total_incidents_resolved, 0)
  INTO current_count
  FROM volunteer_profiles
  WHERE volunteer_user_id = volunteer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Volunteer profile not found for ID %', volunteer_id;
  END IF;
  
  -- Calculate new count
  new_count := current_count + 1;
  
  -- Update the profile
  UPDATE volunteer_profiles
  SET 
    total_incidents_resolved = new_count,
    is_available = TRUE
  WHERE volunteer_user_id = volunteer_id;
  
  -- Return the new count
  RETURN new_count;
END;
$$; 