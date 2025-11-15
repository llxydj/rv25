-- This migration updates all trigger functions to use volunteer_user_id instead of id

-- Update the increment_resolved_incidents function
CREATE OR REPLACE FUNCTION increment_resolved_incidents()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED' THEN
    UPDATE volunteer_profiles
    SET total_incidents_resolved = total_incidents_resolved + 1
    WHERE volunteer_user_id = NEW.assigned_to;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if any other functions reference the old id column
DO $$
DECLARE
  func_name text;
  func_body text;
  fixed_body text;
BEGIN
  -- Loop through all plpgsql functions
  FOR func_name, func_body IN
    SELECT p.proname, pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
  LOOP
    -- If the function references volunteer_profiles.id, update it
    IF func_body LIKE '%volunteer_profiles%id%' AND func_body NOT LIKE '%volunteer_user_id%' THEN
      RAISE NOTICE 'Found function % with possible volunteer_profiles.id reference', func_name;
      
      -- Replace references to 'id' with 'volunteer_user_id' in volunteer_profiles context
      fixed_body := regexp_replace(
        func_body,
        'volunteer_profiles(\s+)[^.]*(id\s*=)',
        'volunteer_profiles\1volunteer_user_\2',
        'g'
      );
      
      -- If we made changes, execute the updated function
      IF fixed_body <> func_body THEN
        RAISE NOTICE 'Updating function %', func_name;
        EXECUTE fixed_body;
      END IF;
    END IF;
  END LOOP;
END;
$$; 