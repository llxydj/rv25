-- Add foreign key constraints for volunteer activities
ALTER TABLE volunteeractivities
ADD CONSTRAINT fk_volunteeractivities_volunteer_user_id
FOREIGN KEY (volunteer_user_id) REFERENCES volunteer_profiles(volunteer_user_id)
ON DELETE CASCADE;

-- Add foreign key constraints for scheduled activities
ALTER TABLE scheduledactivities
ADD CONSTRAINT fk_scheduledactivities_volunteer_user_id
FOREIGN KEY (volunteer_user_id) REFERENCES volunteer_profiles(volunteer_user_id)
ON DELETE CASCADE;

ALTER TABLE scheduledactivities
ADD CONSTRAINT fk_scheduledactivities_created_by
FOREIGN KEY (created_by) REFERENCES users(id)
ON DELETE CASCADE;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_volunteeractivities_volunteer_user_id ON volunteeractivities(volunteer_user_id);
CREATE INDEX IF NOT EXISTS idx_scheduledactivities_volunteer_user_id ON scheduledactivities(volunteer_user_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_profiles_volunteer_user_id ON volunteer_profiles(volunteer_user_id);

-- Add RLS policies for volunteer activities
ALTER TABLE volunteeractivities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Volunteers can view their own activities"
ON volunteeractivities FOR SELECT
TO authenticated
USING (
  volunteer_user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

CREATE POLICY "Volunteers can create their own activities"
ON volunteeractivities FOR INSERT
TO authenticated
WITH CHECK (
  volunteer_user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Add RLS policies for scheduled activities
ALTER TABLE scheduledactivities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Volunteers can view their own schedules"
ON scheduledactivities FOR SELECT
TO authenticated
USING (
  volunteer_user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Add computed column for activity status
ALTER TABLE volunteeractivities
ADD COLUMN IF NOT EXISTS status TEXT 
GENERATED ALWAYS AS (
  CASE 
    WHEN resolved_at IS NOT NULL THEN 'COMPLETED'
    WHEN participated IS TRUE THEN 'IN_PROGRESS'
    ELSE 'PENDING'
  END
) STORED; 