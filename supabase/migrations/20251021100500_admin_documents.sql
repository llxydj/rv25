BEGIN;

-- Storage bucket for admin documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-docs', 'admin-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Admin documents table
CREATE TABLE IF NOT EXISTS public.admin_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL,
  folder_id uuid NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_documents ENABLE ROW LEVEL SECURITY;

-- RLS: owner select/insert/delete, admins full access
DO $$ BEGIN
  CREATE POLICY "admin_docs_owner_select" ON public.admin_documents
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_docs_owner_insert" ON public.admin_documents
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_docs_owner_delete" ON public.admin_documents
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Storage policies for admin-docs bucket
DO $$ BEGIN
  CREATE POLICY "storage_admin_docs_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'admin-docs'
    AND (
      (auth.uid())::text = split_part(name, '/', 1)
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "storage_admin_docs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'admin-docs'
    AND (
      (auth.uid())::text = split_part(name, '/', 1)
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "storage_admin_docs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'admin-docs'
    AND (
      (auth.uid())::text = split_part(name, '/', 1)
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
