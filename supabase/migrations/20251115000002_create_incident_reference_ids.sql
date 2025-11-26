-- Create incident reference IDs table
-- This table maps UUID incident IDs to short, human-readable reference IDs

CREATE TABLE IF NOT EXISTS incident_reference_ids (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    incident_id UUID NOT NULL UNIQUE,
    reference_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_incident_reference_ids_incident_id 
ON incident_reference_ids (incident_id);

CREATE INDEX IF NOT EXISTS idx_incident_reference_ids_reference_id 
ON incident_reference_ids (reference_id);

-- Add foreign key constraint
ALTER TABLE incident_reference_ids 
ADD CONSTRAINT fk_incident_reference_ids_incident_id 
FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON incident_reference_ids TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON incident_reference_ids TO service_role;

-- Add comment for documentation
COMMENT ON TABLE incident_reference_ids IS 'Maps incident UUIDs to short, human-readable reference IDs for SMS and user-friendly identification';