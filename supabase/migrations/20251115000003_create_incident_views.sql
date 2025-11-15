-- Create incident views table
-- This table tracks when users view incidents in the app for acknowledgment tracking

CREATE TABLE IF NOT EXISTS incident_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    incident_id UUID NOT NULL,
    user_id UUID NOT NULL,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_incident_views_incident_id 
ON incident_views (incident_id);

CREATE INDEX IF NOT EXISTS idx_incident_views_user_id 
ON incident_views (user_id);

CREATE INDEX IF NOT EXISTS idx_incident_views_viewed_at 
ON incident_views (viewed_at);

-- Add foreign key constraints
ALTER TABLE incident_views 
ADD CONSTRAINT fk_incident_views_incident_id 
FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE;

ALTER TABLE incident_views 
ADD CONSTRAINT fk_incident_views_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON incident_views TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON incident_views TO service_role;

-- Add comment for documentation
COMMENT ON TABLE incident_views IS 'Tracks when users view incidents in the app for acknowledgment and push notification tracking';