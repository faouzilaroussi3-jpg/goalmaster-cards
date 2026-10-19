ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS alt_photo_author text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS alt_photo_license text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS alt_photo_license_url text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS alt_photo_source text;
COMMENT ON COLUMN public.cards.alt_photo_source IS 'Commons page of the ALT edition photo (credits shown in the collection).';