-- Add image_path column to gallery tables. Stored alongside image_url so we
-- can apply CDN transforms (which need the bucket-relative path) without
-- regex-parsing URLs. Existing rows get a best-effort backfill.

ALTER TABLE trip_gallery ADD COLUMN IF NOT EXISTS image_path text;
ALTER TABLE site_gallery ADD COLUMN IF NOT EXISTS image_path text;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'raw_moments') THEN
    ALTER TABLE raw_moments ADD COLUMN IF NOT EXISTS image_path text;
  END IF;
END $$;

UPDATE trip_gallery
SET image_path = substring(image_url FROM '/cms-media/(.+)$')
WHERE image_path IS NULL AND image_url IS NOT NULL;

UPDATE site_gallery
SET image_path = substring(image_url FROM '/cms-media/(.+)$')
WHERE image_path IS NULL AND image_url IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'raw_moments') THEN
    UPDATE raw_moments
    SET image_path = substring(image_url FROM '/cms-media/(.+)$')
    WHERE image_path IS NULL AND image_url IS NOT NULL;
  END IF;
END $$;
