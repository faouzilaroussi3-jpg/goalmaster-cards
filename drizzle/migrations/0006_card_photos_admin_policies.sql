CREATE POLICY "Admins read card photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'card-photos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins upload card photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'card-photos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update card photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'card-photos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete card photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'card-photos' AND public.has_role(auth.uid(), 'admin'));