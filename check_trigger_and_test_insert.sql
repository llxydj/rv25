-- Comprehensive check: Function, Trigger, and Test
-- This will help us understand the exact situation

-- 1. Check if function exists
SELECT '1. Function Check' as step, 
  proname as name,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'NOT FOUND' END as status
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id'
GROUP BY proname;

-- 2. Show function code (if it exists)
SELECT '2. Function Code' as step,
  prosrc as code
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

-- 3. Check trigger
SELECT '3. Trigger Check' as step,
  tgname as name,
  tgrelid::regclass as table_name,
  CASE WHEN tgenabled = 'O' THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_trigger 
WHERE tgname = 'trigger_generate_incident_reference_id';

-- 4. Search for ANY reference to 'reference_id' in the function (to find the issue)
SELECT '4. Search for reference_id in code' as step,
  CASE 
    WHEN prosrc LIKE '%reference_id%' THEN 'Found reference_id in code'
    ELSE 'No reference_id found'
  END as result,
  -- Extract the DECLARE section
  SUBSTRING(prosrc FROM 'DECLARE(.*?)BEGIN') as declare_section,
  -- Extract the WHERE clause
  SUBSTRING(prosrc FROM 'WHERE[^;]*reference_id[^;]*') as where_clause
FROM pg_proc 
WHERE proname = 'generate_incident_reference_id';

