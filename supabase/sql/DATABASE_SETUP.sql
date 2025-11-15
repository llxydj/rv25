-- ============================================================================
-- DATABASE SETUP FOR RVOIS (Rapid Volunteer Operations & Incident System)
-- ============================================================================
-- This file contains required database views and functions for the system
-- Run these in your Supabase SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VIEW: active_volunteers_with_location
-- Purpose: Provides admin with real-time volunteer locations and status
-- Used by: /api/admin/volunteers/locations
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW active_volunteers_with_location AS
SELECT 
  u.id,
  u.first_name,
  u.last_name,
  u.email,
  u.phone_number,
  vp.skills,
  vp.is_available,
  vp.assigned_barangays,
  vrts.status as realtime_status,
  vrts.status_message,
  vrts.last_activity,
  vl.lat as latitude,
  vl.lng as longitude,
  vl.accuracy,
  vl.created_at as last_location_update
FROM users u
LEFT JOIN volunteer_profiles vp ON u.id = vp.volunteer_user_id
LEFT JOIN volunteer_real_time_status vrts ON u.id = vrts.user_id
LEFT JOIN LATERAL (
  SELECT lat, lng, accuracy, created_at
  FROM volunteer_locations
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) vl ON true
WHERE u.role = 'volunteer';

-- Grant access to authenticated users
GRANT SELECT ON active_volunteers_with_location TO authenticated;

-- ----------------------------------------------------------------------------
-- VERIFY TABLES EXIST
-- Run these queries to check if required tables exist
-- ----------------------------------------------------------------------------

-- Check if all required tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN (
      'users', 
      'incidents', 
      'volunteer_profiles', 
      'volunteer_locations', 
      'volunteer_status',
      'incident_updates',
      'notifications',
      'notification_logs'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'users', 
    'incidents', 
    'volunteer_profiles', 
    'volunteer_locations', 
    'volunteer_status',
    'incident_updates',
    'notifications',
    'notification_logs'
  )
ORDER BY table_name;

-- ----------------------------------------------------------------------------
-- VERIFY COLUMNS IN volunteer_locations TABLE
-- Ensure the table has latitude/longitude columns (not lat/lng)
-- ----------------------------------------------------------------------------

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'volunteer_locations'
ORDER BY ordinal_position;

-- Expected columns:
-- - id (uuid)
-- - user_id (uuid)
-- - lat (double precision) ✅ CONFIRMED
-- - lng (double precision) ✅ CONFIRMED
-- - accuracy (double precision)
-- - speed (double precision)
-- - heading (double precision)
-- - created_at (timestamp)
-- - is_within_talisay_city (boolean)

-- ----------------------------------------------------------------------------
-- TEST QUERIES
-- Run these to verify data exists
-- ----------------------------------------------------------------------------

-- Check if there are any volunteers
SELECT COUNT(*) as volunteer_count 
FROM users 
WHERE role = 'volunteer';

-- Check if volunteers have profiles
SELECT COUNT(*) as profile_count 
FROM volunteer_profiles;

-- Check if volunteers have locations
SELECT COUNT(*) as location_count 
FROM volunteer_locations;

-- Check if volunteers are available
SELECT 
  u.first_name,
  u.last_name,
  vp.is_available,
  vl.latitude,
  vl.longitude,
  vl.created_at as last_location_time
FROM users u
LEFT JOIN volunteer_profiles vp ON u.id = vp.volunteer_user_id
LEFT JOIN LATERAL (
  SELECT latitude, longitude, created_at
  FROM volunteer_locations
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) vl ON true
WHERE u.role = 'volunteer'
ORDER BY vl.created_at DESC NULLS LAST;

-- ----------------------------------------------------------------------------
-- TROUBLESHOOTING
-- ----------------------------------------------------------------------------

-- ✅ The table correctly uses lat/lng columns (not latitude/longitude)
-- No column renaming needed!

-- If volunteers don't have locations, they need to:
-- 1. Open the volunteer app
-- 2. Grant location permissions
-- 3. Enable "Share Location" toggle
-- 4. Wait for GPS to acquire location

-- If volunteers aren't showing as available:
-- UPDATE volunteer_profiles SET is_available = true WHERE volunteer_user_id = 'USER_ID_HERE';

-- ----------------------------------------------------------------------------
-- END OF DATABASE SETUP
-- ----------------------------------------------------------------------------
