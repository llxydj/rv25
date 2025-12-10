-- ============================================================================
-- COMPREHENSIVE DIAGNOSTIC & FIX FOR reference_id AMBIGUOUS ERROR
-- ============================================================================
-- Run this entire script in Supabase SQL Editor
-- It will diagnose the issue and then fix it automatically
-- ============================================================================

-- ============================================================================
-- PART 1: DIAGNOSTIC QUERIES
-- ============================================================================

-- Check 1: Does the function exist?
SELECT 
  'DIAGNOSTIC 1: Function Existence Check' as diagnostic,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Function exists'
    ELSE '❌ Function does NOT exist'
  END as result
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- Check 2: Does the trigger exist?
SELECT 
  'DIAGNOSTIC 2: Trigger Existence Check' as diagnostic,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Trigger exists and is active'
    ELSE '❌ Trigger does NOT exist'
  END as result
FROM pg_trigger 
WHERE tgname = 'trigger_generate_incident_reference_id';

-- Check 3: Show the problematic function code
SELECT 
  'DIAGNOSTIC 3: Current Function Code' as diagnostic,
  prosrc as current_code
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- Check 4: Detect the ambiguous reference issue
SELECT 
  'DIAGNOSTIC 4: Issue Detection' as diagnostic,
  CASE 
    WHEN prosrc LIKE '%WHERE incident_reference_ids.reference_id = reference_id%' 
    THEN '❌ ISSUE CONFIRMED: Ambiguous reference_id found!'
    WHEN prosrc LIKE '%v_reference_id%'
    THEN '✅ Already fixed: Using v_reference_id'
    ELSE '⚠️ Pattern not found - may need manual inspection'
  END as diagnosis,
  'The variable name "reference_id" conflicts with the column name' as explanation
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- Check 5: Verify table structure
SELECT 
  'DIAGNOSTIC 5: Table Structure' as diagnostic,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'incident_reference_ids'
ORDER BY ordinal_position;

-- ============================================================================
-- PART 2: AUTOMATIC FIX
-- ============================================================================
-- This will fix the ambiguous reference_id error by renaming the variable

CREATE OR REPLACE FUNCTION generate_incident_reference_id()
RETURNS TRIGGER AS $$
DECLARE
  v_reference_id VARCHAR(10);  -- ✅ FIXED: Renamed from 'reference_id' to avoid conflict
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  -- Generate unique reference ID
  LOOP
    v_reference_id := 'TC-' || upper(substring(md5(random()::text) from 1 for 4));
    attempts := attempts + 1;
    
    -- Check if reference ID already exists
    -- ✅ FIXED: Now using v_reference_id variable (no ambiguity)
    IF NOT EXISTS (SELECT 1 FROM incident_reference_ids WHERE incident_reference_ids.reference_id = v_reference_id) THEN
      EXIT;
    END IF;
    
    -- Prevent infinite loop
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Unable to generate unique reference ID after % attempts', max_attempts;
    END IF;
  END LOOP;
  
  -- Insert the reference ID mapping
  -- ✅ FIXED: Now using v_reference_id variable
  INSERT INTO incident_reference_ids (incident_id, reference_id)
  VALUES (NEW.id, v_reference_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 3: VERIFICATION
-- ============================================================================

-- Verify the fix was applied
SELECT 
  'VERIFICATION: Fix Applied' as check,
  CASE 
    WHEN prosrc LIKE '%v_reference_id%' 
    THEN '✅ FIX CONFIRMED: Function now uses v_reference_id variable'
    ELSE '❌ Fix may not have been applied correctly'
  END as result
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- Show the updated function code
SELECT 
  'VERIFICATION: Updated Function Code' as check,
  prosrc as fixed_code
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- ============================================================================
-- DONE! The function should now work correctly.
-- Try creating an incident to verify the fix works.
-- ============================================================================

