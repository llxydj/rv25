-- Script to verify and fix reference ID system

-- 1. Check if incident_reference_ids table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_name = 'incident_reference_ids'
) AS table_exists;

-- 2. Check if the trigger function exists
SELECT EXISTS (
   SELECT FROM pg_proc 
   WHERE proname = 'generate_incident_reference_id'
) AS function_exists;

-- 3. Check if the trigger exists
SELECT EXISTS (
   SELECT FROM pg_trigger 
   WHERE tgname = 'trigger_generate_incident_reference_id'
) AS trigger_exists;

-- 4. Check current reference IDs
SELECT COUNT(*) as total_reference_ids FROM incident_reference_ids;

-- 5. Check for incidents without reference IDs
SELECT COUNT(*) as incidents_without_reference_ids
FROM incidents i
LEFT JOIN incident_reference_ids ir ON i.id = ir.incident_id
WHERE ir.incident_id IS NULL;

-- 6. Create missing reference IDs for existing incidents (if needed)
INSERT INTO incident_reference_ids (incident_id, reference_id)
SELECT i.id, 
       'TC-' || upper(substring(md5(random()::text) from 1 for 4)) as reference_id
FROM incidents i
LEFT JOIN incident_reference_ids ir ON i.id = ir.incident_id
WHERE ir.incident_id IS NULL
ON CONFLICT (reference_id) DO NOTHING;

-- 7. Verify the fix
SELECT COUNT(*) as total_reference_ids_after_fix FROM incident_reference_ids;

-- 8. Check for any duplicates
SELECT reference_id, COUNT(*) as count
FROM incident_reference_ids
GROUP BY reference_id
HAVING COUNT(*) > 1;