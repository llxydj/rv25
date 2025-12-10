-- Check Users Table RLS Policies in Detail
-- This will show all policies that might be blocking volunteer access

-- 1. List all RLS policies on users table
SELECT 
  policyname as policy_name,
  cmd as command, -- SELECT, INSERT, UPDATE, DELETE
  roles as applicable_roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- 2. Check if there are any policies that restrict SELECT based on role
SELECT 
  'Policies that might block volunteers' as check_type,
  policyname,
  cmd,
  qual,
  CASE 
    WHEN qual::text LIKE '%role%' AND qual::text NOT LIKE '%volunteer%' THEN '⚠️ Might block volunteers'
    WHEN qual::text LIKE '%volunteer%' THEN '✅ Allows volunteers'
    ELSE '❓ Check manually'
  END as volunteer_access
FROM pg_policies
WHERE tablename = 'users' 
  AND cmd = 'SELECT';

-- 3. Get the actual policy definitions (more detailed)
SELECT 
  p.polname AS policy_name,
  p.polcmd AS command,
  p.polqual AS using_expression,
  p.polwithcheck AS with_check_expression,
  pg_get_expr(p.polqual, p.polrelid) AS using_clause,
  pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_clause
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
WHERE c.relname = 'users'
ORDER BY p.polname;


