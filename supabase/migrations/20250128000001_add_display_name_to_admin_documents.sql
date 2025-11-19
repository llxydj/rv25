-- Add display_name field to admin_documents for custom filename display
ALTER TABLE public.admin_documents 
ADD COLUMN IF NOT EXISTS display_name text;

-- Update existing records to use file_name as display_name
UPDATE public.admin_documents 
SET display_name = file_name 
WHERE display_name IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_documents_display_name 
ON public.admin_documents(display_name);

COMMENT ON COLUMN public.admin_documents.display_name IS 'Custom display name for the document, can be renamed by admin';

