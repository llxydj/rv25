-- Update announcements read policy to allow anon and authenticated users to read
BEGIN;
  DROP POLICY IF EXISTS "announcements_read" ON announcements;
  CREATE POLICY "announcements_read" ON announcements
  FOR SELECT TO anon, authenticated
  USING (true);
COMMIT;
