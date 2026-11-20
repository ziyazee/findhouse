-- Public or private listing.
-- A private listing still opens from its link (/p/:slug) for anyone the broker shares it with, but it isn't shown
-- on the broker's public page (/b/:brokerId) and asks search engines not to index it.
-- New listings, and every listing that existed before this migration, start private.
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_properties_public_by_broker
  ON public.properties(broker_id) WHERE is_public;

-- Name and phone for a broker's public page; no row unless the broker is ACTIVE.
CREATE OR REPLACE FUNCTION public.get_broker_page(page_broker_id uuid)
RETURNS TABLE (name text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(btrim(b.name), ''), b.phone
  FROM public.brokers b
  WHERE b.id = page_broker_id
    AND b.status = 'ACTIVE'
$$;

REVOKE ALL ON FUNCTION public.get_broker_page(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_broker_page(uuid) TO anon, authenticated;
