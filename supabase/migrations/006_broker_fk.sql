-- ─────────────────────────────────────────────────────────────────────────────
-- 006 — Broker foreign keys on whatsapp_submissions + properties
--
-- Run this in the Supabase SQL editor.
-- All statements are idempotent (IF NOT EXISTS / DO NOTHING guards).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add broker_id to whatsapp_submissions
--    ON DELETE SET NULL so deleting a broker record does not destroy submission history.
ALTER TABLE public.whatsapp_submissions
  ADD COLUMN IF NOT EXISTS broker_id uuid
    REFERENCES public.brokers(id) ON DELETE SET NULL;

-- 2. Add property_id to whatsapp_submissions (bidirectional link: submission → property)
ALTER TABLE public.whatsapp_submissions
  ADD COLUMN IF NOT EXISTS property_id uuid
    REFERENCES public.properties(id) ON DELETE SET NULL;

-- 3. Add failure_reason to whatsapp_submissions (used by failSession)
ALTER TABLE public.whatsapp_submissions
  ADD COLUMN IF NOT EXISTS failure_reason text;

-- 4. Add broker_id to properties
--    Nullable so existing manually-created properties without a broker are untouched.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS broker_id uuid
    REFERENCES public.brokers(id) ON DELETE SET NULL;

-- 5. Extend the status enum with PROCESSING if it does not already exist.
--    whatsapp_submissions uses this value as an in-flight guard while
--    process-submission is running, preventing duplicate processing.
DO $$ BEGIN
  ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'PROCESSING';
EXCEPTION
  WHEN undefined_object THEN
    -- The enum is named differently or does not exist; skip gracefully.
    NULL;
END $$;

-- 6. Indexes for broker-scoped queries (pipeline monitor sidebar, dashboard stats)
CREATE INDEX IF NOT EXISTS idx_whatsapp_submissions_broker_id
  ON public.whatsapp_submissions (broker_id);

CREATE INDEX IF NOT EXISTS idx_properties_broker_id
  ON public.properties (broker_id);

-- 7. RLS: brokers can read their own submissions through the new FK.
--    Edge Functions bypass RLS via service role and are unaffected.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_submissions'
      AND schemaname = 'public'
      AND policyname = 'broker_own_submissions'
  ) THEN
    CREATE POLICY "broker_own_submissions"
      ON public.whatsapp_submissions FOR SELECT
      USING (broker_id = auth.uid());
  END IF;
END $$;
