-- ===================================================================
-- INDEX VERIFICATION SCRIPT
-- ===================================================================
-- Run these queries after implementing database-performance-indexes.sql
-- to verify everything is working correctly
-- ===================================================================

-- ===================================================================
-- PART 1: BASIC VERIFICATION
-- ===================================================================

-- Check total number of indexes created
SELECT COUNT(*) as total_indexes,
       pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname LIKE 'idx_%';
-- Expected: ~101 indexes, ~35 MB

-- List all new indexes
SELECT 
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname LIKE 'idx_%'
ORDER BY tablename, indexrelname;

-- ===================================================================
-- PART 2: VERIFY CRITICAL INDEXES EXIST
-- ===================================================================

-- Check incidents table indexes (should have 18)
SELECT indexname
FROM pg_indexes
WHERE tablename = 'incidents'
  AND schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- Check location_tracking indexes (should have 8)
SELECT indexname
FROM pg_indexes
WHERE tablename = 'location_tracking'
  AND schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- Check notifications indexes (should have 7)
SELECT indexname
FROM pg_indexes
WHERE tablename = 'notifications'
  AND schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- Check volunteer_profiles indexes (should have 10)
SELECT indexname
FROM pg_indexes
WHERE tablename = 'volunteer_profiles'
  AND schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- ===================================================================
-- PART 3: CHECK FOR MISSING FOREIGN KEY INDEXES
-- ===================================================================

-- Should return EMPTY (no missing FK indexes)
SELECT * FROM find_missing_fk_indexes();

-- ===================================================================
-- PART 4: VERIFY INDEX USAGE
-- ===================================================================

-- Check which indexes are being used (run after some usage)
SELECT 
  tablename,
  indexname,
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname LIKE 'idx_%'
ORDER BY idx_scan DESC
LIMIT 20;

-- ===================================================================
-- PART 5: TEST QUERY PERFORMANCE
-- ===================================================================

-- Test 1: Admin Dashboard - Recent Pending Incidents
-- Should use: idx_incidents_status_created_at
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM incidents 
WHERE status = 'PENDING' 
ORDER BY created_at DESC 
LIMIT 20;
-- Look for: "Index Scan using idx_incidents_status_created_at"

-- Test 2: Real-Time Location Tracking
-- Should use: idx_location_tracking_recent_active
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM location_tracking 
WHERE timestamp > NOW() - INTERVAL '5 minutes'
ORDER BY timestamp DESC;
-- Look for: "Index Scan using idx_location_tracking_recent_active"

-- Test 3: Volunteer Assignment
-- Should use: idx_incidents_assigned_to_status
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM incidents 
WHERE assigned_to IS NOT NULL
  AND status != 'RESOLVED' 
ORDER BY created_at DESC;
-- Look for: "Index Scan using idx_incidents_assigned_to_status"

-- Test 4: Unread Notifications
-- Should use: idx_notifications_user_unread
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM notifications 
WHERE user_id = (SELECT id FROM users LIMIT 1)
  AND read_at IS NULL 
ORDER BY sent_at DESC;
-- Look for: "Index Scan using idx_notifications_user_unread"

-- Test 5: Barangay Incidents
-- Should use: idx_incidents_barangay_status
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM incidents 
WHERE barangay = 'Talisay'
  AND status = 'PENDING'
ORDER BY created_at DESC;
-- Look for: "Index Scan using idx_incidents_barangay_status"

-- Test 6: Location History for User
-- Should use: idx_location_tracking_user_timestamp
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM location_tracking 
WHERE user_id = (SELECT id FROM users WHERE role = 'volunteer' LIMIT 1)
ORDER BY timestamp DESC 
LIMIT 100;
-- Look for: "Index Scan using idx_location_tracking_user_timestamp"

-- ===================================================================
-- PART 6: CHECK TABLE AND INDEX SIZES
-- ===================================================================

-- View all table sizes with indexes
SELECT * FROM get_table_sizes()
ORDER BY total_size DESC;

-- ===================================================================
-- PART 7: VERIFY SPECIAL INDEX TYPES
-- ===================================================================

-- Check GIN indexes (full-text search, arrays, JSONB)
SELECT 
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes i
JOIN pg_stat_user_indexes s ON i.indexname = s.indexrelname
WHERE i.schemaname = 'public'
  AND i.indexdef LIKE '%USING gin%'
ORDER BY tablename, indexname;
-- Expected: 16 GIN indexes

-- Check GIST indexes (geospatial)
SELECT 
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes i
JOIN pg_stat_user_indexes s ON i.indexname = s.indexrelname
WHERE i.schemaname = 'public'
  AND i.indexdef LIKE '%USING gist%'
ORDER BY tablename, indexname;
-- Expected: 4 GIST indexes

-- Check partial indexes (WHERE clause)
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef LIKE '%WHERE%'
ORDER BY tablename, indexname;
-- Expected: 6+ partial indexes

-- ===================================================================
-- PART 8: PERFORMANCE BENCHMARKS
-- ===================================================================

-- Benchmark 1: Count pending incidents
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM incidents WHERE status = 'PENDING';
-- Should be very fast (<10ms)

-- Benchmark 2: Active volunteers in last 5 minutes
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(DISTINCT user_id) 
FROM location_tracking 
WHERE timestamp > NOW() - INTERVAL '5 minutes';
-- Should use index, <50ms

-- Benchmark 3: Unread notification count per user
EXPLAIN (ANALYZE, BUFFERS)
SELECT user_id, COUNT(*) as unread_count
FROM notifications 
WHERE read_at IS NULL
GROUP BY user_id;
-- Should be fast, <100ms

-- ===================================================================
-- PART 9: INDEX HEALTH CHECK
-- ===================================================================

-- Check for bloated indexes (should be minimal after fresh creation)
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname LIKE 'idx_%'
  AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
-- Large indexes with 0 scans may need investigation (but give it time)

-- ===================================================================
-- PART 10: VERIFY MONITORING FUNCTIONS
-- ===================================================================

-- Test check_index_usage function
SELECT * FROM check_index_usage() LIMIT 10;

-- Test find_missing_fk_indexes function
SELECT * FROM find_missing_fk_indexes();

-- Test get_table_sizes function
SELECT * FROM get_table_sizes() LIMIT 10;

-- ===================================================================
-- PART 11: DETAILED INDEX INFORMATION
-- ===================================================================

-- Get detailed info for most important indexes
SELECT 
  i.tablename,
  i.indexname,
  i.indexdef,
  pg_size_pretty(pg_relation_size(s.indexrelid)) as size,
  s.idx_scan as scans,
  s.idx_tup_read as tuples_read
FROM pg_indexes i
JOIN pg_stat_user_indexes s ON i.indexname = s.indexrelname
WHERE i.schemaname = 'public'
  AND i.indexname IN (
    'idx_incidents_status_created_at',
    'idx_location_tracking_recent_active',
    'idx_notifications_user_unread',
    'idx_incidents_assigned_to_status',
    'idx_volunteer_profiles_status_available'
  )
ORDER BY i.indexname;

-- ===================================================================
-- PART 12: FINAL SUMMARY
-- ===================================================================

-- Overall summary
SELECT 
  'Index Creation Summary' as report,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%') as total_indexes,
  (SELECT pg_size_pretty(SUM(pg_relation_size(indexrelid))) FROM pg_stat_user_indexes WHERE schemaname = 'public' AND indexrelname LIKE 'idx_%') as total_index_size,
  (SELECT COUNT(*) FROM find_missing_fk_indexes()) as missing_fk_indexes,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%') >= 100 
    THEN '✅ SUCCESS'
    ELSE '❌ INCOMPLETE'
  END as status;

-- ===================================================================
-- SUCCESS CRITERIA
-- ===================================================================
-- ✅ Total indexes >= 100
-- ✅ Total size ~35 MB
-- ✅ Missing FK indexes = 0
-- ✅ EXPLAIN ANALYZE shows "Index Scan" for test queries
-- ✅ Query times < 100ms for most queries
-- ===================================================================
