-- Migration: Add responding_at column to incidents table
-- Purpose: Track when volunteers mark incidents as responding
-- Date: 2025-11-02

-- Add responding_at column to incidents table
ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS responding_at TIMESTAMP WITH TIME ZONE;