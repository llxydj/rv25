-- Complete Diagnostic: Show Function Code and Detect Issue
-- Run this to see the actual problem

-- Query 1: Show the current function source code
SELECT 
  '1. Current Function Code' as step,
  prosrc as function_code
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- Query 2: Detect if the ambiguous reference issue exists
SELECT 
  '2. Issue Detection' as step,
  CASE 
    WHEN prosrc LIKE '%WHERE incident_reference_ids.reference_id = reference_id%' 
    THEN '❌ ISSUE CONFIRMED: Ambiguous reference_id detected!'
    WHEN prosrc LIKE '%v_reference_id%'
    THEN '✅ Already fixed: Using v_reference_id variable'
    ELSE '⚠️ Pattern not found - may need manual inspection'
  END as diagnosis,
  CASE 
    WHEN prosrc LIKE '%WHERE incident_reference_ids.reference_id = reference_id%' 
    THEN 'The variable "reference_id" conflicts with the column name "reference_id"'
    ELSE 'No ambiguous reference detected'
  END as explanation
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- Query 3: Show the problematic line (if it exists)
SELECT 
  '3. Problematic Pattern' as step,
  CASE 
    WHEN prosrc LIKE '%WHERE incident_reference_ids.reference_id = reference_id%' 
    THEN 'Found: WHERE incident_reference_ids.reference_id = reference_id'
    ELSE 'Not found'
  END as found_pattern
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

