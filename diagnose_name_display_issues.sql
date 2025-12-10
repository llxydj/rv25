-- Diagnostic Queries for Name Display Issues
-- Run these in Supabase SQL Editor to diagnose RLS and data issues

-- ========================================
-- 1. CHECK RLS POLICIES ON USERS TABLE
-- ========================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- ========================================
-- 2. CHECK IF ADMIN CAN READ ALL USERS
-- ========================================
-- Replace 'YOUR_ADMIN_USER_ID' with actual admin user ID
SELECT 
  id,
  first_name,
  last_name,
  email,
  role
FROM public.users
LIMIT 10;

-- ========================================
-- 3. CHECK INCIDENT REPORTER DATA
-- ========================================
SELECT 
  i.id as incident_id,
  i.incident_type,
  i.reporter_id,
  i.assigned_to,
  r.id as reporter_user_id,
  r.first_name as reporter_first_name,
  r.last_name as reporter_last_name,
  r.email as reporter_email,
  a.id as assignee_user_id,
  a.first_name as assignee_first_name,
  a.last_name as assignee_last_name,
  a.email as assignee_email
FROM public.incidents i
LEFT JOIN public.users r ON i.reporter_id = r.id
LEFT JOIN public.users a ON i.assigned_to = a.id
ORDER BY i.created_at DESC
LIMIT 10;

-- ========================================
-- 4. CHECK IF VOLUNTEER_PROFILES EXISTS FOR VOLUNTEERS
-- ========================================
SELECT 
  u.id,
  u.first_name,
  u.last_name,
  u.email,
  u.role,
  vp.volunteer_user_id,
  CASE 
    WHEN vp.volunteer_user_id IS NOT NULL THEN 'Has volunteer profile'
    ELSE 'No volunteer profile'
  END as profile_status
FROM public.users u
LEFT JOIN public.volunteer_profiles vp ON u.id = vp.volunteer_user_id
WHERE u.role = 'volunteer'
LIMIT 10;

-- ========================================
-- 5. CHECK IS_ADMIN_USER FUNCTION
-- ========================================
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'is_admin_user';

-- ========================================
-- 6. TEST RLS POLICY EVALUATION
-- ========================================
-- This will show what policies apply for current user
-- Run as admin user
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, first_name, last_name, email, role
FROM public.users
WHERE id IN (
  SELECT reporter_id FROM public.incidents LIMIT 5
);

-- ========================================
-- 7. CHECK FOR POLICY CONFLICTS
-- ========================================
-- Policies that might conflict
SELECT 
  policyname,
  cmd,
  qual,
  CASE 
    WHEN qual LIKE '%auth.uid()%' THEN 'Uses auth.uid()'
    WHEN qual LIKE '%is_admin_user%' THEN 'Uses is_admin_user()'
    WHEN qual LIKE '%volunteer_profiles%' THEN 'Uses volunteer_profiles'
    ELSE 'Other'
  END as policy_type
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

