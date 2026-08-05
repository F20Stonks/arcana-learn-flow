DROP POLICY IF EXISTS "Authenticated can read reference paper files" ON storage.objects;
CREATE POLICY "Anyone can read reference paper files" ON storage.objects
  FOR SELECT USING (bucket_id = 'reference-papers');