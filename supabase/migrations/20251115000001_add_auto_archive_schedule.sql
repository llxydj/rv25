-- Add table for auto-archive scheduling configuration
-- This table stores the configuration for automatic report archiving

-- Create the auto_archive_schedule table
CREATE TABLE IF NOT EXISTS auto_archive_schedule (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    enabled BOOLEAN DEFAULT false,
    schedule_frequency TEXT DEFAULT 'daily', -- daily, weekly, monthly
    schedule_time TIME DEFAULT '02:00:00', -- Time of day to run (2 AM default)
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    years_old INTEGER DEFAULT 2, -- Archive reports older than this many years
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_auto_archive_schedule_updated_at 
    BEFORE UPDATE ON auto_archive_schedule 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

-- Insert a default schedule configuration
INSERT INTO auto_archive_schedule (enabled, schedule_frequency, schedule_time, years_old)
VALUES (false, 'daily', '02:00:00', 2)
ON CONFLICT DO NOTHING;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_auto_archive_schedule_enabled 
ON auto_archive_schedule (enabled);

CREATE INDEX IF NOT EXISTS idx_auto_archive_schedule_next_run 
ON auto_archive_schedule (next_run);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON auto_archive_schedule TO authenticated;
GRANT SELECT, INSERT, UPDATE ON auto_archive_schedule TO service_role;

-- Update the migration history
INSERT INTO schema_migrations (version, inserted_at) 
VALUES ('20251115000001', NOW());