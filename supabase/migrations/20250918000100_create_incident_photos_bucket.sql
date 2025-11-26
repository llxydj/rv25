-- Create storage bucket for incident photos (id = 'incident-photos') if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'incident-photos'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('incident-photos', 'incident-photos', false);
  END IF;
END $$;



