-- Real authentication and row-level security (fixes audit item C1).
--
-- Every broker now has a Supabase Auth user behind the scenes (email "<phone>@brokers.findhouse.in", the password
-- they chose when registering). The browser signs in with it and every request carries the broker's JWT, so the
-- database knows who is asking. Policies then let a broker see and change only their own rows.
-- The anon (public) key can no longer write anything and can no longer read brokers or WhatsApp messages.
--
-- Run after 017_invite_only_registration.sql. Brokers who registered with the old password flow (016/017) must
-- register again: their password was stored differently.
-- Also needed: in the Supabase dashboard, Authentication → Sign In / Providers → turn OFF "Allow new users to sign up"
-- (accounts are created only by the register function, which uses the service key).

-- ── Link brokers to auth users ─────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- The broker making this request, only while their account is ACTIVE. Null for the public (anon) key.
CREATE OR REPLACE FUNCTION public.current_broker_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id FROM public.brokers b WHERE b.auth_user_id = auth.uid() AND b.status = 'ACTIVE'
$$;
REVOKE ALL ON FUNCTION public.current_broker_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_broker_id() TO anon, authenticated;

-- The signed-in broker's own row, whatever its status, so the app can say "blocked" instead of "not found".
CREATE OR REPLACE FUNCTION public.broker_me()
RETURNS TABLE (id uuid, phone text, name text, status text, subdomain text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.phone, nullif(btrim(b.name), ''), b.status::text, b.subdomain
  FROM public.brokers b
  WHERE b.auth_user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.broker_me() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broker_me() TO authenticated;

-- Used by the upload API: does the signed-in broker own this property?
CREATE OR REPLACE FUNCTION public.owns_property(pid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.properties p WHERE p.id = pid AND p.broker_id = public.current_broker_id())
$$;
REVOKE ALL ON FUNCTION public.owns_property(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_property(uuid) TO authenticated;

-- ── Registration ───────────────────────────────────────────────────────────────────────────────────────────────
-- Is this number allowed to register? 'not_invited' | 'not_active' | 'already_registered' | 'invited'.
-- "Registered" now means the broker has an auth user.
CREATE OR REPLACE FUNCTION public.broker_register_check(check_phone text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.brokers%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.brokers WHERE phone = check_phone;
  IF NOT FOUND THEN RETURN 'not_invited'; END IF;
  IF b.status <> 'ACTIVE' THEN RETURN 'not_active'; END IF;
  IF b.auth_user_id IS NOT NULL THEN RETURN 'already_registered'; END IF;
  RETURN 'invited';
END;
$$;
REVOKE ALL ON FUNCTION public.broker_register_check(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broker_register_check(text) TO anon, authenticated;

-- Called only by the register function (service key), after it has created the auth user. Links it to the broker
-- and saves the name and the site name made from it. Outcomes: 'registered', or one of the check results above, or
--   'invalid_name' / 'name_reserved' / 'name_taken'
-- When the outcome isn't 'registered' the caller deletes the auth user it just made.
CREATE OR REPLACE FUNCTION public.broker_link_auth_user(reg_phone text, reg_user_id uuid, reg_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.brokers%ROWTYPE;
  wanted text := public.subdomain_from_name(reg_name);
  check_result text := public.broker_register_check(reg_phone);
BEGIN
  IF check_result <> 'invited' THEN RETURN check_result; END IF;
  IF wanted !~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$' THEN RETURN 'invalid_name'; END IF;
  IF public.is_reserved_subdomain(wanted) THEN RETURN 'name_reserved'; END IF;

  SELECT * INTO b FROM public.brokers WHERE phone = reg_phone FOR UPDATE;
  IF b.auth_user_id IS NOT NULL THEN RETURN 'already_registered'; END IF;
  IF EXISTS (SELECT 1 FROM public.brokers o WHERE o.subdomain = wanted AND o.id <> b.id) THEN RETURN 'name_taken'; END IF;

  UPDATE public.brokers SET auth_user_id = reg_user_id, name = btrim(reg_name), subdomain = wanted WHERE id = b.id;
  RETURN 'registered';
END;
$$;
REVOKE ALL ON FUNCTION public.broker_link_auth_user(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.broker_link_auth_user(text, uuid, text) TO service_role;

-- The old password flow is replaced by Supabase Auth.
DROP FUNCTION IF EXISTS public.broker_sign_in(text, text);
DROP FUNCTION IF EXISTS public.broker_register(text, text, text);
DROP TABLE IF EXISTS public.broker_credentials;

-- A broker changes their own site name. The id comes from the sign-in, not from the client.
-- Errors: 22023 'invalid' or 'reserved', 23505 when taken, P0002 when not signed in as an active broker.
DROP FUNCTION IF EXISTS public.set_broker_subdomain(uuid, text);
CREATE OR REPLACE FUNCTION public.set_my_subdomain(new_subdomain text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wanted text := lower(btrim(new_subdomain));
  me uuid := public.current_broker_id();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'no active broker' USING ERRCODE = 'P0002';
  END IF;
  IF wanted !~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$' OR wanted LIKE '%--%' THEN
    RAISE EXCEPTION 'invalid' USING ERRCODE = '22023';
  END IF;
  IF public.is_reserved_subdomain(wanted) THEN
    RAISE EXCEPTION 'reserved' USING ERRCODE = '22023';
  END IF;
  UPDATE public.brokers SET subdomain = wanted WHERE id = me;
  RETURN wanted;
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_subdomain(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_subdomain(text) TO authenticated;

-- Listing ids must be unique across ALL listings, including ones the caller can't see.
CREATE OR REPLACE FUNCTION public.new_short_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  candidate text;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.properties WHERE short_id = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

-- ── Row-level security ─────────────────────────────────────────────────────────────────────────────────────────
-- Start from a clean slate: drop whatever policies exist on these tables (some were made by hand in the dashboard)
-- and define exactly what is allowed.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('brokers', 'properties', 'property_media', 'whatsapp_submissions', 'whatsapp_submission_messages')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.brokers                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_media               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_submissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_submission_messages ENABLE ROW LEVEL SECURITY;

-- Table privileges: the public key only reads listings. Edge functions use the service key and skip all of this.
REVOKE ALL ON public.brokers, public.properties, public.property_media,
              public.whatsapp_submissions, public.whatsapp_submission_messages FROM anon, authenticated;
GRANT SELECT                         ON public.properties, public.property_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties, public.property_media TO authenticated;
GRANT SELECT                         ON public.brokers, public.whatsapp_submission_messages TO authenticated;
GRANT SELECT, UPDATE                 ON public.whatsapp_submissions TO authenticated;

-- Brokers: only your own row. The public broker page and listing contact come from SECURITY DEFINER functions.
CREATE POLICY brokers_read_own ON public.brokers
  FOR SELECT TO authenticated USING (id = public.current_broker_id());

-- Listings: anyone can open an available listing from its link (public pages), and a broker has full control of theirs
-- (including rented, sold and draft ones).
CREATE POLICY properties_public_read ON public.properties
  FOR SELECT TO anon, authenticated USING (status = 'available');
CREATE POLICY properties_owner_all ON public.properties
  FOR ALL TO authenticated
  USING (broker_id = public.current_broker_id())
  WITH CHECK (broker_id = public.current_broker_id());

CREATE POLICY property_media_public_read ON public.property_media
  FOR SELECT TO anon, authenticated
  USING (property_id IN (SELECT id FROM public.properties WHERE status = 'available'));
CREATE POLICY property_media_owner_all ON public.property_media
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_media.property_id AND p.broker_id = public.current_broker_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_media.property_id AND p.broker_id = public.current_broker_id()));

-- WhatsApp submissions and their messages: the broker who sent them.
CREATE POLICY submissions_owner_read ON public.whatsapp_submissions
  FOR SELECT TO authenticated USING (broker_id = public.current_broker_id());
CREATE POLICY submissions_owner_update ON public.whatsapp_submissions
  FOR UPDATE TO authenticated
  USING (broker_id = public.current_broker_id())
  WITH CHECK (broker_id = public.current_broker_id());
CREATE POLICY submission_messages_owner_read ON public.whatsapp_submission_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whatsapp_submissions s
                 WHERE s.id = whatsapp_submission_messages.submission_id AND s.broker_id = public.current_broker_id()));
