-- Drop existing tables if they exist
DROP TABLE IF EXISTS activity_volunteer_assignments;
DROP TABLE IF EXISTS activity_schedules;
DROP TABLE IF EXISTS schedules;

-- Create the schedules table
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  volunteer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  barangay TEXT,
  created_by UUID REFERENCES users(id), -- Admin who created this schedule
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_schedules_volunteer_id ON schedules(volunteer_id);
CREATE INDEX idx_schedules_created_by ON schedules(created_by);
CREATE INDEX idx_schedules_start_time ON schedules(start_time);
CREATE INDEX idx_schedules_barangay ON schedules(barangay);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_schedules_updated_at
    BEFORE UPDATE ON schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_schedules_updated_at(); 