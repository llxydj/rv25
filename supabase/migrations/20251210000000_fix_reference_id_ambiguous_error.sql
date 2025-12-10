-- Migration: Fix ambiguous reference_id error in trigger function
-- Purpose: Rename PL/pgSQL variable to avoid conflict with table column name
-- Date: 2025-12-10

-- Fix the trigger function by renaming the variable to avoid ambiguity
CREATE OR REPLACE FUNCTION generate_incident_reference_id()
RETURNS TRIGGER AS $$
DECLARE
  v_reference_id VARCHAR(10);  -- Renamed from 'reference_id' to avoid conflict with column name
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  -- Generate unique reference ID
  LOOP
    v_reference_id := 'TC-' || upper(substring(md5(random()::text) from 1 for 4));
    attempts := attempts + 1;
    
    -- Check if reference ID already exists
    -- FIX: Use v_reference_id variable instead of ambiguous reference_id
    IF NOT EXISTS (SELECT 1 FROM incident_reference_ids WHERE incident_reference_ids.reference_id = v_reference_id) THEN
      EXIT;
    END IF;
    
    -- Prevent infinite loop
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Unable to generate unique reference ID after % attempts', max_attempts;
    END IF;
  END LOOP;
  
  -- Insert the reference ID mapping
  INSERT INTO incident_reference_ids (incident_id, reference_id)
  VALUES (NEW.id, v_reference_id);  -- Use v_reference_id variable
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

