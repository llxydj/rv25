-- Check if function exists and show its actual code
-- Run this to see what's actually in the database

-- First, check if the function exists
SELECT 
  'Function Existence Check' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Function EXISTS'
    ELSE '❌ Function does NOT exist'
  END as result,
  COUNT(*) as function_count
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- Show the actual function source code (this is what we need to see)
SELECT 
  'Actual Function Code' as check_type,
  proname as function_name,
  prosrc as source_code,
  LENGTH(prosrc) as code_length
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- Also check the full function definition
SELECT 
  'Full Function Definition' as check_type,
  pg_get_functiondef(oid) as full_definition
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- Check if trigger exists
SELECT 
  'Trigger Check' as check_type,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as is_enabled
FROM pg_trigger 
WHERE tgname = 'trigger_generate_incident_reference_id';

