-- FIX: Resolve ambiguous reference_id error in trigger function
-- This fix preserves all existing logic including race condition protection
-- The problem: The PL/pgSQL variable 'reference_id' conflicts with the table column 'reference_id'

CREATE OR REPLACE FUNCTION generate_incident_reference_id()
RETURNS TRIGGER AS $$
DECLARE
  v_reference_id VARCHAR(10);  -- ✅ FIXED: Renamed from 'reference_id' to avoid conflict with column name
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  -- Check if reference ID already exists (race condition protection)
  IF EXISTS (SELECT 1 FROM public.incident_reference_ids WHERE incident_id = NEW.id) THEN
    RETURN NEW; -- Already exists, skip creation
  END IF;

  -- Generate unique reference ID
  LOOP
    v_reference_id := 'TC-' || upper(substring(md5(random()::text) from 1 for 4));
    attempts := attempts + 1;
    
    -- Check if reference ID already exists
    -- ✅ FIXED: Use v_reference_id variable instead of ambiguous reference_id
    IF NOT EXISTS (SELECT 1 FROM public.incident_reference_ids WHERE public.incident_reference_ids.reference_id = v_reference_id) THEN
      EXIT;
    END IF;
    
    -- Prevent infinite loop
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Unable to generate unique reference ID after % attempts', max_attempts;
    END IF;
  END LOOP;
  
  -- Insert the reference ID mapping
  -- Use ON CONFLICT to handle race conditions gracefully
  -- ✅ FIXED: Use v_reference_id variable instead of ambiguous reference_id
  INSERT INTO public.incident_reference_ids (incident_id, reference_id)
  VALUES (NEW.id, v_reference_id)
  ON CONFLICT (incident_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

