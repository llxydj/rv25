-- Announcements table and RLS
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT CHECK (type IN ('TRAINING','MEETING','ALERT','GENERAL')) NOT NULL DEFAULT 'GENERAL',
  priority TEXT CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')) NOT NULL DEFAULT 'LOW',
  location TEXT,
  date DATE,
  time TEXT,
  requirements TEXT[],
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policies: allow read to authenticated, write to admins
DROP POLICY IF EXISTS "announcements_read" ON announcements;
CREATE POLICY "announcements_read" ON announcements
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "announcements_admin_write" ON announcements;
CREATE POLICY "announcements_admin_write" ON announcements
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));



