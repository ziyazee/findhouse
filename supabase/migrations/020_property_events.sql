-- What visitors and brokers do with a listing, for the Performance page: page views, shares, and taps on Call or
-- WhatsApp (an enquiry). One small row per event; nobody reads the table directly.
--   • The public page records events through track_property_event (works for the anon key, one row per call).
--   • A broker reads their own totals through broker_property_stats (their listings only, grouped by day).

CREATE TABLE IF NOT EXISTS public.property_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('view', 'share', 'call', 'whatsapp')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS property_events_property_time ON public.property_events (property_id, created_at DESC);

-- RLS on with no policies: the table is closed to every key. Only the two functions below touch it.
ALTER TABLE public.property_events ENABLE ROW LEVEL SECURITY;

-- Records one event. A broker looking at their own listing isn't a view or an enquiry, so those are skipped;
-- their own shares do count (sharing is what the broker does with the link).
CREATE OR REPLACE FUNCTION public.track_property_event(pid uuid, event_kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner uuid;
BEGIN
  IF event_kind NOT IN ('view', 'share', 'call', 'whatsapp') THEN RETURN; END IF;
  SELECT broker_id INTO owner FROM public.properties WHERE id = pid;
  IF owner IS NULL THEN RETURN; END IF;
  IF event_kind <> 'share' AND owner = public.current_broker_id() THEN RETURN; END IF;
  INSERT INTO public.property_events (property_id, kind) VALUES (pid, event_kind);
END
$$;
REVOKE ALL ON FUNCTION public.track_property_event(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_property_event(uuid, text) TO anon, authenticated;

-- The signed-in broker's events for the last `days` days, counted per listing, kind and day.
CREATE OR REPLACE FUNCTION public.broker_property_stats(days integer DEFAULT 30)
RETURNS TABLE (property_id uuid, kind text, day date, n bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.property_id, e.kind, (e.created_at AT TIME ZONE 'Asia/Kolkata')::date AS day, count(*) AS n
  FROM public.property_events e
  JOIN public.properties p ON p.id = e.property_id
  WHERE p.broker_id = public.current_broker_id()
    AND e.created_at >= now() - make_interval(days => least(greatest(days, 1), 365))
  GROUP BY 1, 2, 3
$$;
REVOKE ALL ON FUNCTION public.broker_property_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broker_property_stats(integer) TO authenticated;
