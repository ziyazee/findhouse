-- Agent name for a public listing page ("Listed by …").
-- Same rules as get_listing_contact: only for an available listing of an ACTIVE broker, and null when the
-- broker hasn't set a name.
CREATE OR REPLACE FUNCTION public.get_listing_agent_name(listing_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(btrim(b.name), '')
  FROM public.properties p
  JOIN public.brokers b ON b.id = p.broker_id
  WHERE p.id = listing_id
    AND p.status = 'available'
    AND b.status = 'ACTIVE'
$$;

REVOKE ALL ON FUNCTION public.get_listing_agent_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_listing_agent_name(uuid) TO anon, authenticated;
