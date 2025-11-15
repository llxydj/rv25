-- Incident severity support
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_severity') THEN
    CREATE TYPE incident_severity AS ENUM ('MINOR', 'MODERATE', 'SEVERE', 'CRITICAL');
  END IF;
END $$;

ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS severity incident_severity DEFAULT 'MODERATE';

-- Backfill from priority if column existed already
UPDATE incidents
SET severity = (
  CASE
    WHEN priority >= 5 THEN 'CRITICAL'
    WHEN priority = 4 THEN 'SEVERE'
    WHEN priority = 3 THEN 'MODERATE'
    ELSE 'MINOR'
  END
)::incident_severity
WHERE severity IS NULL;


