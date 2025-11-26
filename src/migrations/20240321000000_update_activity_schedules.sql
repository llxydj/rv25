-- Create activity_volunteer_assignments junction table
CREATE TABLE IF NOT EXISTS activity_volunteer_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    activity_id UUID NOT NULL REFERENCES activity_schedules(id) ON DELETE CASCADE,
    volunteer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
    response_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(activity_id, volunteer_user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_volunteer_assignments_activity_id 
    ON activity_volunteer_assignments(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_volunteer_assignments_volunteer_user_id 
    ON activity_volunteer_assignments(volunteer_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_volunteer_assignments_status 
    ON activity_volunteer_assignments(status);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_activity_volunteer_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_activity_volunteer_assignments_updated_at
    BEFORE UPDATE ON activity_volunteer_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_activity_volunteer_assignments_updated_at();

-- Update activity_schedules table
ALTER TABLE activity_schedules
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' 
        CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    ADD COLUMN IF NOT EXISTS max_volunteers INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS required_skills TEXT[] DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL; 