-- ─────────────────────────────────────────────────────────────────────────────
-- 007 — Image classification columns
--
-- Run this in the Supabase SQL editor.
-- All statements use IF NOT EXISTS / idempotent guards.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Per-image: AI description and confidence score
--    category column already exists (text, nullable).
ALTER TABLE public.property_media
  ADD COLUMN IF NOT EXISTS ai_description text,
  ADD COLUMN IF NOT EXISTS ai_confidence  numeric(4, 3);   -- 0.000 – 1.000

-- 2. Per-property: classification lifecycle tracking
--    Enum-like text column — checked values enforced by the Edge Function.
--    Valid values: PENDING | PROCESSING | COMPLETED | PARTIAL_FAILURE | FAILED
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS image_classification_status text
    NOT NULL DEFAULT 'PENDING';

-- 3. Per-property: run metadata (model, tokens, cost, timing)
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS image_classification_metadata jsonb
    NOT NULL DEFAULT '{}'::jsonb;

-- 4. Index so the Edge Function can quickly find unclassified media
CREATE INDEX IF NOT EXISTS idx_property_media_unclassified
  ON public.property_media (property_id)
  WHERE category IS NULL;

-- 5. Index for dashboard queries filtering by classification status
CREATE INDEX IF NOT EXISTS idx_properties_classification_status
  ON public.properties (image_classification_status);
