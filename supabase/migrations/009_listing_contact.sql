-- Contact number for a public listing page.
-- Brokers stay private under RLS; this returns only the phone of an ACTIVE broker
-- whose listing is available, and nothing for any other row or status.
CREATE OR REPLACE FUNCTION public.get_listing_contact(listing_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.phone
  FROM public.properties p
  JOIN public.brokers b ON b.id = p.broker_id
  WHERE p.id = listing_id
    AND p.status = 'available'
    AND b.status = 'ACTIVE'
$$;

REVOKE ALL ON FUNCTION public.get_listing_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_listing_contact(uuid) TO anon, authenticated;
