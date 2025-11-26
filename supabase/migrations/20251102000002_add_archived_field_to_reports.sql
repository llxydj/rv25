-- Add archived field to reports table for year-based archiving
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Add index for performance on archived field
CREATE INDEX IF NOT EXISTS idx_reports_archived ON public.reports (archived);

-- Add comment for documentation
COMMENT ON COLUMN public.reports.archived IS 'Indicates if the report has been archived for year-end organization';