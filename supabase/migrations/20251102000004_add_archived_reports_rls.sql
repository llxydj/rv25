-- Add RLS policies for archived reports
-- Only admins can read archived reports
CREATE POLICY "admin_read_archived_reports"
ON public.reports FOR SELECT
TO authenticated
USING (
  archived = true AND
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Prevent updates to archived reports
CREATE POLICY "prevent_update_archived_reports"
ON public.reports FOR UPDATE
TO authenticated
USING (
  archived = false
)
WITH CHECK (
  archived = false AND
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Prevent deletion of archived reports
CREATE POLICY "prevent_delete_archived_reports"
ON public.reports FOR DELETE
TO authenticated
USING (
  archived = false AND
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Add comment for documentation
COMMENT ON POLICY "admin_read_archived_reports" ON public.reports 
IS 'Allow admins to read archived reports';
COMMENT ON POLICY "prevent_update_archived_reports" ON public.reports 
IS 'Prevent updates to archived reports';
COMMENT ON POLICY "prevent_delete_archived_reports" ON public.reports 
IS 'Prevent deletion of archived reports';