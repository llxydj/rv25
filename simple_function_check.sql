-- Simple query to find and show the function
-- This should work even if there are schema issues

SELECT 
  n.nspname as schema,
  p.proname as function_name,
  p.prosrc as code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname LIKE '%generate_incident_reference%';

