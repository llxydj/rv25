-- Create storage bucket for incident voice messages (id = 'incident-voice') if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'incident-voice'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'incident-voice',
      'incident-voice',
      false,
      5242880, -- 5MB limit
      ARRAY['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg']
    );
  END IF;
END $$;

-- RLS Policies for storage.objects
-- Note: These require proper permissions (typically run with service role)
-- Using "if not exists" pattern like volunteer-docs migration

create policy if not exists "storage_incident_voice_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'incident-voice' AND
  auth.role() = 'authenticated'
);

create policy if not exists "storage_incident_voice_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'incident-voice' AND
  (
    -- Users can read their own voice messages
    (auth.uid())::text = split_part(name, '/', 1)
    OR
    -- Admins can read all voice messages
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Volunteers can read voice messages for assigned incidents
    EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.assigned_to = auth.uid()
      AND i.voice_url = storage.objects.name
    )
  )
);

