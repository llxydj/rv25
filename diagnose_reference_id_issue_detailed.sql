-- Detailed Diagnostic: Find the Ambiguous reference_id Issue
-- This query will show you the exact problem in the function code

-- Show the current function source code (this is where the bug is)
SELECT 
  'Current Function Code' as check_type,
  prosrc as code_with_issue
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- Expected Issue: You should see a line like:
-- "IF NOT EXISTS (SELECT 1 FROM incident_reference_ids WHERE incident_reference_ids.reference_id = reference_id)"
-- 
-- The problem: The variable 'reference_id' on the right side conflicts with the column name
-- PostgreSQL can't tell if 'reference_id' refers to:
--   1. The PL/pgSQL variable declared as "reference_id VARCHAR(10);"
--   2. The table column "incident_reference_ids.reference_id"

-- Check if the function has the problematic pattern
SELECT 
  CASE 
    WHEN prosrc LIKE '%WHERE incident_reference_ids.reference_id = reference_id%' 
    THEN '❌ ISSUE FOUND: Ambiguous reference_id detected!'
    ELSE '✅ No ambiguous reference found'
  END as diagnosis,
  'The function uses "reference_id" as both a variable name and column name' as explanation
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- Show what the fix should look like
SELECT 
  'Expected Fix' as check_type,
  'Rename variable from "reference_id" to "v_reference_id" in DECLARE section' as fix_step_1,
  'Change WHERE clause to use "v_reference_id" instead of "reference_id"' as fix_step_2,
  'Change INSERT VALUES to use "v_reference_id" instead of "reference_id"' as fix_step_3;

