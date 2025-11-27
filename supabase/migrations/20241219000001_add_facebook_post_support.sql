-- Add Facebook post integration support to announcements table
-- This allows admins to embed Facebook posts alongside regular announcements

-- Add Facebook post URL field (optional)
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS facebook_post_url TEXT;

-- Add Facebook embed data (stores oEmbed response as JSONB for caching)
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS facebook_embed_data JSONB;

-- Add source type to distinguish between regular and Facebook posts
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('MANUAL', 'FACEBOOK')) DEFAULT 'MANUAL';

-- Add index for filtering by source type
CREATE INDEX IF NOT EXISTS idx_announcements_source_type 
ON announcements (source_type);

-- Add index for Facebook URL lookups
CREATE INDEX IF NOT EXISTS idx_announcements_facebook_url 
ON announcements (facebook_post_url) 
WHERE facebook_post_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN announcements.facebook_post_url IS 'URL of the Facebook post to embed';
COMMENT ON COLUMN announcements.facebook_embed_data IS 'Cached oEmbed data from Facebook API';
COMMENT ON COLUMN announcements.source_type IS 'Source of announcement: MANUAL (created in app) or FACEBOOK (embedded from Facebook)';

