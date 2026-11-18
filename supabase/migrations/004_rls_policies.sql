-- Enable RLS on all tables
ALTER TABLE public.brokers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_numbers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_media    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages  ENABLE ROW LEVEL SECURITY;

-- ── Brokers ────────────────────────────────────────────────────────────────────
CREATE POLICY "broker_read_own"
  ON public.brokers FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "broker_update_own"
  ON public.brokers FOR UPDATE
  USING (id = auth.uid());

-- ── WhatsApp Numbers ──────────────────────────────────────────────────────────
CREATE POLICY "broker_own_numbers"
  ON public.whatsapp_numbers FOR ALL
  USING (broker_id = auth.uid());

-- ── Properties ────────────────────────────────────────────────────────────────
-- Brokers manage their own properties
CREATE POLICY "broker_own_properties"
  ON public.properties FOR ALL
  USING (broker_id = auth.uid());

-- Public can read available properties (for property site pages)
CREATE POLICY "public_read_available"
  ON public.properties FOR SELECT
  USING (status = 'available');

-- ── Property Media ────────────────────────────────────────────────────────────
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
  );

-- ── Submission Sessions ───────────────────────────────────────────────────────
CREATE POLICY "broker_own_sessions"
  ON public.submission_sessions FOR SELECT
  USING (broker_id = auth.uid());

-- ── Session Messages ──────────────────────────────────────────────────────────
CREATE POLICY "broker_own_messages"
  ON public.session_messages FOR SELECT
  USING (broker_id = auth.uid());

-- Note: Edge Functions use the service role key and bypass RLS entirely.
-- They are responsible for enforcing data isolation in their own logic.
