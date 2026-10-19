ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS photo_author text,
  ADD COLUMN IF NOT EXISTS photo_license text,
  ADD COLUMN IF NOT EXISTS photo_license_url text,
  ADD COLUMN IF NOT EXISTS photo_source text;
COMMENT ON COLUMN public.cards.photo_source IS 'Source page of the licensed player photograph, shown in the collection photo credits.';