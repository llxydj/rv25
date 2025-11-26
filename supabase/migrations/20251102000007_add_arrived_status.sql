-- Migration: Add ARRIVED status to incidents table
-- Purpose: Support extended status workflow for volunteer incidents
-- Date: 2025-11-02

-- This migration adds the ARRIVED status to the incidents table enum
-- Note: This is for future use and not immediately required for OTW workflow
-- The current OTW workflow uses RESPONDING status

-- No changes needed as the database already supports the status values
-- This is just for documentation purposes

-- To add ARRIVED status to the enum in PostgreSQL, we would typically need to:
-- 1. Create a new enum type with the additional value
-- 2. Update the column to use the new enum type
-- 3. Drop the old enum type
-- However, since we're using text-based status fields, no database changes are needed

-- Example of how this would be done if we were using proper enum types:
-- ALTER TYPE incident_status ADD VALUE 'ARRIVED' AFTER 'RESPONDING';

-- For now, the application handles the status values in code