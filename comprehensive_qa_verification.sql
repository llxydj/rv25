-- Comprehensive QA Verification Script
-- Run this to verify all fixes are correct and no issues exist

-- ============================================
-- 1. VERIFY RLS POLICY IS CORRECT
-- ============================================
SELECT 
  '1. RLS Policy Verification' as check_type,
  policyname,
  cmd,
  CASE 
    WHEN qual::text LIKE '%is_volunteer_user%' 
      THEN '❌ CRITICAL: Still uses is_volunteer_user - WILL CAUSE RECURSION!'
    WHEN qual::text LIKE '%volunteer_profiles%'
      THEN '✅ SAFE: Uses volunteer_profiles (no recursion)'
    WHEN qual::text LIKE '%users.role%' AND qual::text NOT LIKE '%volunteer_profiles%'
      THEN '⚠️ WARNING: May query users table - check for recursion'
    ELSE '✅ Policy exists'
  END as policy_status,
  qual::text as policy_condition
FROM pg_policies
WHERE tablename = 'users' 
  AND policyname = 'volunteers_read_incident_participants';

-- ============================================
-- 2. VERIFY VOLUNTEER_PROFILES TABLE EXISTS
-- ============================================
SELECT 
  '2. Volunteer Profiles Table Check' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'volunteer_profiles')
      THEN '✅ Table exists'
    ELSE '❌ CRITICAL: volunteer_profiles table does not exist!'
  END as table_status,
  COUNT(*) as volunteer_count
FROM volunteer_profiles;

-- ============================================
-- 3. VERIFY VOLUNTEERS HAVE PROFILES
-- ============================================
SELECT 
  '3. Volunteer Profile Coverage' as check_type,
  COUNT(DISTINCT u.id) as total_volunteers,
  COUNT(DISTINCT vp.volunteer_user_id) as volunteers_with_profiles,
  CASE 
    WHEN COUNT(DISTINCT u.id) = COUNT(DISTINCT vp.volunteer_user_id)
      THEN '✅ All volunteers have profiles'
    WHEN COUNT(DISTINCT vp.volunteer_user_id) = 0
      THEN '❌ CRITICAL: No volunteer profiles exist!'
    ELSE '⚠️ WARNING: Some volunteers missing profiles'
  END as coverage_status
FROM users u
LEFT JOIN volunteer_profiles vp ON u.id = vp.volunteer_user_id
WHERE u.role = 'volunteer';

-- ============================================
-- 4. TEST POLICY LOGIC (Simulation)
-- ============================================
SELECT 
  '4. Policy Logic Test' as check_type,
  i.id as incident_id,
  i.assigned_to as volunteer_id,
  i.reporter_id,
  CASE 
    WHEN i.assigned_to IS NULL THEN '⚠️ Incident not assigned'
    WHEN EXISTS (
      SELECT 1 FROM volunteer_profiles vp 
      WHERE vp.volunteer_user_id = i.assigned_to
    ) THEN '✅ Volunteer has profile - policy should work'
    ELSE '❌ Volunteer has NO profile - policy will block access!'
  END as policy_test_result
FROM incidents i
WHERE i.id = '2274bdab-9933-43aa-a5b0-3e514924ebeb'
LIMIT 1;

-- ============================================
-- 5. VERIFY NO RECURSIVE FUNCTIONS EXIST
-- ============================================
SELECT 
  '5. Function Safety Check' as check_type,
  proname as function_name,
  CASE 
    WHEN proname = 'is_volunteer_user' 
      THEN '❌ CRITICAL: is_volunteer_user still exists - DROP IT!'
    ELSE '✅ Safe'
  END as function_status
FROM pg_proc
WHERE proname = 'is_volunteer_user';

-- ============================================
-- 6. VERIFY ADMIN FUNCTION STILL WORKS
-- ============================================
SELECT 
  '6. Admin Function Check' as check_type,
  proname as function_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin_user')
      THEN '✅ Admin function exists'
    ELSE '❌ CRITICAL: is_admin_user missing!'
  END as function_status
FROM pg_proc
WHERE proname = 'is_admin_user'
LIMIT 1;

-- ============================================
-- 7. CHECK FOR DUPLICATE POLICIES
-- ============================================
SELECT 
  '7. Duplicate Policy Check' as check_type,
  policyname,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) > 1 THEN '❌ WARNING: Duplicate policies found!'
    WHEN COUNT(*) = 1 THEN '✅ Single policy exists'
    ELSE '❌ CRITICAL: Policy missing!'
  END as duplicate_status
FROM pg_policies
WHERE tablename = 'users' 
  AND policyname = 'volunteers_read_incident_participants'
GROUP BY policyname;

-- ============================================
-- 8. VERIFY ALL USERS TABLE POLICIES
-- ============================================
SELECT 
  '8. All Users Policies Summary' as check_type,
  COUNT(*) as total_policies,
  COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) as select_policies,
  COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) as insert_policies,
  COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) as update_policies,
  COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) as delete_policies
FROM pg_policies
WHERE tablename = 'users';

