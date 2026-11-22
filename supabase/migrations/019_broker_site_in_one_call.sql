-- A broker's public page in a single request: who they are and every listing they've made public, with its photos.
-- Before, the page asked for the broker first and the listings second, one after the other. On a slow connection each
-- step costs a second or more, so this halves the wait for the data. Run after 018.
--
-- Returns null when there is no ACTIVE broker with that id or subdomain. Same visibility rules as before: only
-- public listings that are on the market (available), newest first. The rows have the same shape as the table rows,
-- with the photos under `property_media`.
CREATE OR REPLACE FUNCTION public.get_broker_site(page_broker_id uuid DEFAULT NULL, page_subdomain text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', b.id,
    'name', NULLIF(btrim(b.name), ''),
    'phone', b.phone,
    'subdomain', b.subdomain,
    'listings', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(p) || jsonb_build_object(
          'property_media',
          COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM public.property_media m WHERE m.property_id = p.id), '[]'::jsonb)
        )
        ORDER BY p.created_at DESC
      )
      FROM public.properties p
      WHERE p.broker_id = b.id AND p.is_public AND p.status = 'available'
    ), '[]'::jsonb)
  )
  FROM public.brokers b
  WHERE b.status = 'ACTIVE'
    AND (b.id = page_broker_id OR b.subdomain = lower(btrim(page_subdomain)))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_broker_site(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_broker_site(uuid, text) TO anon, authenticated;
