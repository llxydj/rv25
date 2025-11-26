-- Optional: Concurrent Index Creation for Production
-- Run this SEPARATELY after the main migration if you need non-blocking indexes
-- Only use in production with active users to avoid blocking table access

-- IMPORTANT: 
-- - This cannot be run inside a transaction block
-- - Run these statements ONE AT A TIME in Supabase SQL Editor
-- - Do NOT run with other migrations
-- - Safe to run multiple times (IF NOT EXISTS)

-- =====================================================
-- CONCURRENT INDEX CREATION
-- =====================================================

-- Index 1: Recent locations (last hour)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_locations_recent_concurrent
ON volunteer_locations(created_at DESC) 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Index 2: User + timestamp lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_locations_user_time_concurrent
ON volunteer_locations(user_id, created_at DESC);

-- Optional Index 3: Spatial queries (if PostGIS is enabled)
-- Uncomment if you have PostGIS extension installed
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volunteer_locations_coords_concurrent
-- ON volunteer_locations USING GIST (ST_Point(lng, lat));

-- =====================================================
-- NOTES
-- =====================================================
--
-- What is CONCURRENTLY?
-- - Creates indexes without blocking writes to the table
-- - Takes longer but doesn't lock the table
-- - Good for production with active traffic
--
-- When to use this:
-- ✅ Production environment with users
-- ✅ Large tables (>10,000 rows)
-- ✅ Cannot afford downtime
--
-- When NOT needed:
-- ❌ Development/testing
-- ❌ Small tables (<10,000 rows)
-- ❌ Low traffic times
--
-- The main migration already created regular indexes.
-- Only run this if you need to recreate them concurrently.
--
-- =====================================================
