-- Listing and status enums
CREATE TYPE listing_type AS ENUM ('sale', 'rent');
CREATE TYPE property_status AS ENUM ('available', 'sold', 'rented');
CREATE TYPE media_type AS ENUM ('image', 'video');

-- Properties
CREATE TABLE public.properties (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id      uuid NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  session_id     uuid,              -- FK added after submissions table exists
  slug           text NOT NULL UNIQUE,
  title          text NOT NULL,
  property_type  text NOT NULL DEFAULT '',
  listing_type   listing_type NOT NULL DEFAULT 'sale',
  status         property_status NOT NULL DEFAULT 'available',
  price          numeric,
  location       text,
  locality       text,
  bedrooms       int,
  bathrooms      int,
  built_up_area  numeric,
  carpet_area    numeric,
  furnishing     text,
  floor          text,
  total_floors   int,
  parking        text,
  amenities      text[] NOT NULL DEFAULT '{}',
  description    text,
  raw_data       jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Property media
CREATE TABLE public.property_media (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  media_type     media_type NOT NULL,
  storage_path   text NOT NULL,
  category       text,
  display_order  int NOT NULL DEFAULT 0,
  is_cover       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Keep updated_at current
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
