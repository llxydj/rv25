-- Add the column manually
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS created_year INT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS created_year INT;

-- Create a function to set the year
CREATE OR REPLACE FUNCTION set_created_year()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_year := EXTRACT(YEAR FROM NEW.created_at)::INT;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for both tables
CREATE TRIGGER trg_set_incidents_year
BEFORE INSERT OR UPDATE ON public.incidents
FOR EACH ROW EXECUTE FUNCTION set_created_year();

CREATE TRIGGER trg_set_reports_year
BEFORE INSERT OR UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION set_created_year();

-- Now you can index safely
CREATE INDEX IF NOT EXISTS idx_incidents_year ON public.incidents (created_year);
CREATE INDEX IF NOT EXISTS idx_reports_year ON public.reports (created_year);

-- Also keep the original created_at indexes for date range queries
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON public.incidents (created_at);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports (created_at);

-- Add comment for documentation
COMMENT ON INDEX idx_incidents_created_at IS 'Index for efficient date range queries on incidents';
COMMENT ON INDEX idx_reports_created_at IS 'Index for efficient date range queries on reports';
COMMENT ON INDEX idx_incidents_year IS 'Index for efficient year-based queries on incidents';
COMMENT ON INDEX idx_reports_year IS 'Index for efficient year-based queries on reports';