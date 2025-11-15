-- Fix barangays table RLS policy
-- This migration ensures that all authenticated users can read barangays data

-- Enable RLS on barangays table if not already enabled
ALTER TABLE barangays ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Anyone can view barangays" ON barangays;

-- Create policy to allow all authenticated users to read barangays
CREATE POLICY "Anyone can view barangays" ON barangays
  FOR SELECT USING (true);

-- Also allow anonymous access for public dropdowns (optional)
-- Uncomment the line below if you want to allow unauthenticated access
-- CREATE POLICY "Anonymous can view barangays" ON barangays
--   FOR SELECT USING (true);
