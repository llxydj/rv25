-- Diagnostic Queries to Identify the reference_id Ambiguous Error
-- Run these queries in Supabase SQL Editor to diagnose the issue

-- 1. Check if the trigger function exists
SELECT 
  proname as function_name,
  prosrc as function_source_code
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- 2. Check if the trigger exists and is active
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as is_enabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger 
WHERE tgname = 'trigger_generate_incident_reference_id';

-- 3. Check the incident_reference_ids table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'incident_reference_ids'
ORDER BY ordinal_position;

-- 4. Check if there are any existing reference IDs (to verify table works)
SELECT COUNT(*) as total_reference_ids
FROM incident_reference_ids;

-- 5. Get the full function definition with line numbers (to see the exact issue)
SELECT 
  pg_get_functiondef(oid) as full_function_definition
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- 6. Check for any syntax errors by attempting to view the function body
-- This will show us the exact code that's causing the issue
SELECT 
  proname,
  prosrc
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

