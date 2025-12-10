-- Find the function in all schemas
-- The function might be in a different schema

-- 1. Check all schemas for the function
SELECT 
  'Function in All Schemas' as check_type,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'generate_incident_reference_id';

-- 2. Show the function code from all schemas
SELECT 
  'Function Code from All Schemas' as check_type,
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosrc as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'generate_incident_reference_id';

-- 3. Check what schema the trigger is using
SELECT 
  'Trigger Schema Info' as check_type,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as is_enabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger 
WHERE tgname = 'trigger_generate_incident_reference_id';

-- 4. Try to find the function with schema qualification
SELECT 
  'Function with Schema' as check_type,
  n.nspname || '.' || p.proname as full_function_name,
  p.prosrc as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'generate_incident_reference_id';

