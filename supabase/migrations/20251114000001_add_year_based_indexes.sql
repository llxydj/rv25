-- Add indexes for efficient year-based queries
-- This migration improves performance for the auto-archiving feature

-- Index on reports.created_at for faster year-based filtering
CREATE INDEX IF NOT EXISTS idx_reports_created_at_year 
ON reports USING btree (created_at);

-- Index on reports.archived for faster archived status queries
CREATE INDEX IF NOT EXISTS idx_reports_archived 
ON reports USING btree (archived);

-- Composite index for year-based archived queries (using EXTRACT instead of DATE_PART)
CREATE INDEX IF NOT EXISTS idx_reports_year_archived 
ON reports USING btree (
    EXTRACT(YEAR FROM created_at), 
    archived
);

-- Index on incidents.created_at for faster year-based filtering
CREATE INDEX IF NOT EXISTS idx_incidents_created_at_year 
ON incidents USING btree (created_at);

-- Update the migration history
INSERT INTO schema_migrations (version, inserted_at) 
VALUES ('20251114000001', NOW());