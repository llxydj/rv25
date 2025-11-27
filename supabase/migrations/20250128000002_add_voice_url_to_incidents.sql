-- Add voice_url column to incidents table
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS voice_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.incidents.voice_url IS 'URL to voice message recording for this incident';

