DROP POLICY IF EXISTS "venue photos public read" ON storage.objects;
CREATE POLICY "venue photos auth read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'venue-photos');