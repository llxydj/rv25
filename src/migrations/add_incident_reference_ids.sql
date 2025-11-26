-- Migration: Add incident reference IDs table
-- Purpose: Store short, human-readable reference IDs for incidents
-- Date: 2025-01-22

-- Create incident_reference_ids table
CREATE TABLE IF NOT EXISTS incident_reference_ids (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  reference_id VARCHAR(10) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_incident_reference_ids_incident_id ON incident_reference_ids(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_reference_ids_reference_id ON incident_reference_ids(reference_id);
CREATE INDEX IF NOT EXISTS idx_incident_reference_ids_created_at ON incident_reference_ids(created_at);

-- Add RLS policies
ALTER TABLE incident_reference_ids ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view reference IDs for incidents they're involved in
CREATE POLICY "Users can view reference IDs for their incidents" ON incident_reference_ids
  FOR SELECT USING (
    incident_id IN (
      SELECT id FROM incidents 
      WHERE reporter_id = auth.uid() 
      OR assigned_to = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'barangay')
      )
    )
  );

-- Policy: System can insert reference IDs
CREATE POLICY "System can insert reference IDs" ON incident_reference_ids
  FOR INSERT WITH CHECK (true);

-- Policy: System can update reference IDs
CREATE POLICY "System can update reference IDs" ON incident_reference_ids
  FOR UPDATE USING (true);

-- Create function to automatically generate reference IDs for new incidents
CREATE OR REPLACE FUNCTION generate_incident_reference_id()
RETURNS TRIGGER AS $$
DECLARE
  reference_id VARCHAR(10);
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  -- Generate unique reference ID
  LOOP
    reference_id := 'TC-' || upper(substring(md5(random()::text) from 1 for 4));
    attempts := attempts + 1;
    
    -- Check if reference ID already exists
    IF NOT EXISTS (SELECT 1 FROM incident_reference_ids WHERE incident_reference_ids.reference_id = reference_id) THEN
      EXIT;
    END IF;
    
    -- Prevent infinite loop
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Unable to generate unique reference ID after % attempts', max_attempts;
    END IF;
  END LOOP;
  
  -- Insert the reference ID mapping
  INSERT INTO incident_reference_ids (incident_id, reference_id)
  VALUES (NEW.id, reference_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically generate reference IDs
DROP TRIGGER IF EXISTS trigger_generate_incident_reference_id ON incidents;
CREATE TRIGGER trigger_generate_incident_reference_id
  AFTER INSERT ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION generate_incident_reference_id();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_incident_reference_ids_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_incident_reference_ids_updated_at ON incident_reference_ids;
CREATE TRIGGER trigger_update_incident_reference_ids_updated_at
  BEFORE UPDATE ON incident_reference_ids
  FOR EACH ROW
  EXECUTE FUNCTION update_incident_reference_ids_updated_at();

-- Add comment to table
COMMENT ON TABLE incident_reference_ids IS 'Stores short, human-readable reference IDs for incidents (e.g., TC-A1B2)';
COMMENT ON COLUMN incident_reference_ids.incident_id IS 'Foreign key to incidents table';
COMMENT ON COLUMN incident_reference_ids.reference_id IS 'Short reference ID (e.g., TC-A1B2)';
COMMENT ON COLUMN incident_reference_ids.created_at IS 'When the reference ID was created';
COMMENT ON COLUMN incident_reference_ids.updated_at IS 'When the reference ID was last updated';
