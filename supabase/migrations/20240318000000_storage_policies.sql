-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies for incident-photos bucket
CREATE POLICY "Allow authenticated users to upload photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'incident-photos' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to read photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'incident-photos');

CREATE POLICY "Allow authenticated users to update their own photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'incident-photos')
WITH CHECK (
  bucket_id = 'incident-photos' AND
  (auth.uid() = owner OR owner IS NULL)
);

CREATE POLICY "Allow authenticated users to delete their own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'incident-photos' AND
  (auth.uid() = owner OR owner IS NULL)
); 