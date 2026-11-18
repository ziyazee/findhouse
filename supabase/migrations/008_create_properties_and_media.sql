-- ============================================================
-- 008_create_properties_and_media.sql
-- Safe to run on a fresh DB or one that partially has these tables.
-- Combines migrations 002 + 006 (properties parts) + 007.
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE listing_type AS ENUM ('sale', 'rent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE property_status AS ENUM ('available', 'sold', 'rented');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE media_type AS ENUM ('image', 'video');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Trigger function ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Properties ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.properties (
  id                            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id                     uuid         REFERENCES public.brokers(id) ON DELETE SET NULL,
  session_id                    uuid,
  slug                          text         NOT NULL UNIQUE,
  title                         text         NOT NULL,
  property_type                 text         NOT NULL DEFAULT '',
  listing_type                  listing_type NOT NULL DEFAULT 'sale',
  status                        property_status NOT NULL DEFAULT 'available',
  price                         numeric,
  deposit                       numeric,
  location                      text,
  locality                      text,
  bedrooms                      int,
  bathrooms                     int,
  balconies                     int,
  built_up_area                 numeric,
  carpet_area                   numeric,
  furnishing                    text,
  floor                         text,
  total_floors                  int,
  parking                       text,
  move_in_date                  text,
  other                         jsonb        NOT NULL DEFAULT '{}',
  amenities                     text[]       NOT NULL DEFAULT '{}',
  description                   text,
  raw_data                      jsonb        NOT NULL DEFAULT '{}',
  cover_image_id                uuid,
  image_classification_status   text         NOT NULL DEFAULT 'PENDING',
  image_classification_metadata jsonb        NOT NULL DEFAULT '{}',
  created_at                    timestamptz  NOT NULL DEFAULT now(),
  updated_at                    timestamptz  NOT NULL DEFAULT now()
);

-- Backfill any columns that might be missing on an older table
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS deposit                      numeric;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS balconies                    int;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS move_in_date                 text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS other                        jsonb        NOT NULL DEFAULT '{}';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS amenities                    text[]       NOT NULL DEFAULT '{}';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS cover_image_id               uuid;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS image_classification_status  text         NOT NULL DEFAULT 'PENDING';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS image_classification_metadata jsonb       NOT NULL DEFAULT '{}';

-- session_id FK (whatsapp_submissions already exists in live DB)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'properties_session_id_fkey'
    AND table_name = 'properties'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.whatsapp_submissions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Updated-at trigger
DROP TRIGGER IF EXISTS properties_updated_at ON public.properties;
CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Property Media ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.property_media (
  id             uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    uuid       NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  media_type     media_type NOT NULL,
  storage_path   text       NOT NULL,
  category       text,
  display_order  int        NOT NULL DEFAULT 0,
  is_cover       boolean    NOT NULL DEFAULT false,
  ai_description text,
  ai_confidence  numeric(4,3),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Backfill any columns that might be missing on an older table
ALTER TABLE public.property_media ADD COLUMN IF NOT EXISTS ai_description text;
ALTER TABLE public.property_media ADD COLUMN IF NOT EXISTS ai_confidence numeric(4,3);

-- cover_image_id FK now that property_media exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'properties_cover_image_id_fkey'
    AND table_name = 'properties'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_cover_image_id_fkey
      FOREIGN KEY (cover_image_id) REFERENCES public.property_media(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_properties_broker_id
  ON public.properties(broker_id);
CREATE INDEX IF NOT EXISTS idx_properties_status
  ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_classification_status
  ON public.properties(image_classification_status);

CREATE INDEX IF NOT EXISTS idx_property_media_property_id
  ON public.property_media(property_id);
-- Partial index so classify-images can quickly find unclassified rows
CREATE INDEX IF NOT EXISTS idx_property_media_unclassified
  ON public.property_media(property_id) WHERE category IS NULL;

-- ── whatsapp_submissions: backfill missing columns from migration 006 ─────────
ALTER TABLE public.whatsapp_submissions ADD COLUMN IF NOT EXISTS broker_id       uuid REFERENCES public.brokers(id)     ON DELETE SET NULL;
ALTER TABLE public.whatsapp_submissions ADD COLUMN IF NOT EXISTS property_id     uuid REFERENCES public.properties(id)  ON DELETE SET NULL;
ALTER TABLE public.whatsapp_submissions ADD COLUMN IF NOT EXISTS failure_reason  text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_submissions_broker_id
  ON public.whatsapp_submissions(broker_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_submissions_property_id
  ON public.whatsapp_submissions(property_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.properties    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broker_own_properties"  ON public.properties;
DROP POLICY IF EXISTS "public_read_available"  ON public.properties;
DROP POLICY IF EXISTS "broker_own_media"       ON public.property_media;
DROP POLICY IF EXISTS "public_read_media"      ON public.property_media;

-- Brokers see and manage their own properties
CREATE POLICY "broker_own_properties"
  ON public.properties FOR ALL
  USING (broker_id = auth.uid());

-- Anyone can read available listings
CREATE POLICY "public_read_available"
  ON public.properties FOR SELECT
  USING (status = 'available');

-- Brokers see and manage media that belongs to their properties
CREATE POLICY "broker_own_media"
  ON public.property_media FOR ALL
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE broker_id = auth.uid()
    )
  );

-- Public can read media for available properties
CREATE POLICY "public_read_media"
  ON public.property_media FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE status = 'available'
    )
  );do

-- ── Grants (needed by anon key for the pipeline test page) ───────────────────
GRANT SELECT ON TABLE public.properties     TO anon;
GRANT SELECT ON TABLE public.property_media TO anon;
