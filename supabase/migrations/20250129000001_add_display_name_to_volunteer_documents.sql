-- Add display_name field to volunteer_documents for custom filename display
ALTER TABLE public.volunteer_documents
ADD COLUMN IF NOT EXISTS display_name text;

-- Update existing records to use file_name as display_name
UPDATE public.volunteer_documents
SET display_name = file_name 
WHERE display_name IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_volunteer_documents_display_name 
ON public.volunteer_documents(display_name);

-- Add comment
COMMENT ON COLUMN public.volunteer_documents.display_name IS 'Custom display name for the document, can be renamed by volunteer';

