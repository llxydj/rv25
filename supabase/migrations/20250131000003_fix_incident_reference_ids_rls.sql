-- Fix RLS policy for incident_reference_ids to allow authenticated inserts
-- This fixes the error: "new row violates row-level security policy for table incident_reference_ids"
-- Date: 2025-01-31

-- Drop existing INSERT policies to avoid conflicts
DROP POLICY IF EXISTS "System can insert reference IDs" ON public.incident_reference_ids;
DROP POLICY IF EXISTS "Authenticated users can insert reference IDs" ON public.incident_reference_ids;
DROP POLICY IF EXISTS "Allow authenticated inserts for reference IDs" ON public.incident_reference_ids;

-- The issue: The policy WITH CHECK (true) should work, but it seems RLS is still blocking
-- Solution: Create an explicit policy that allows authenticated users and service_role
-- Note: service_role bypasses RLS anyway, but we're being explicit here

-- Create a permissive INSERT policy
-- For INSERT operations, WITH CHECK determines if the row can be inserted
CREATE POLICY "Allow authenticated inserts for reference IDs" ON public.incident_reference_ids
  FOR INSERT 
  WITH CHECK (true);

-- Also ensure grants are correct (they should already be set, but verify)
GRANT INSERT ON public.incident_reference_ids TO authenticated;
GRANT INSERT ON public.incident_reference_ids TO service_role;

