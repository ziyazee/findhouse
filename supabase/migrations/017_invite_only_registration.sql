-- Invite-only registration.
-- FindHouse staff add a broker's WhatsApp number in the admin page (/admin), which creates the broker row. The broker
-- then registers on the website: number → name, password. Numbers nobody added can't register, and the WhatsApp
-- webhook no longer creates brokers (see brokerManager.ts). Run after 016_password_login_and_short_ids.sql.

-- A broker is "registered" once they have a password (a row in broker_credentials).

-- Sign-in no longer sets a password on first login: that is what registering is for.
-- Outcomes: 'ok', 'wrong_password', 'no_account', 'not_active', and
--   'not_registered'  the number was added by FindHouse but the broker hasn't registered yet
CREATE OR REPLACE FUNCTION public.broker_sign_in(login_phone text, login_password text)
RETURNS TABLE (outcome text, id uuid, phone text, status text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  b public.brokers%ROWTYPE;
  stored text;
BEGIN
  SELECT * INTO b FROM public.brokers WHERE brokers.phone = login_phone;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'no_account'::text, NULL::uuid, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  IF b.status <> 'ACTIVE' THEN
    RETURN QUERY SELECT 'not_active'::text, b.id, b.phone, b.status::text, NULL::text;
    RETURN;
  END IF;

  SELECT c.password_hash INTO stored FROM public.broker_credentials c WHERE c.broker_id = b.id;
  IF stored IS NULL THEN
    RETURN QUERY SELECT 'not_registered'::text, NULL::uuid, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF stored = crypt(login_password, stored) THEN
    RETURN QUERY SELECT 'ok'::text, b.id, b.phone, b.status::text, nullif(btrim(b.name), '');
  ELSE
    RETURN QUERY SELECT 'wrong_password'::text, NULL::uuid, NULL::text, NULL::text, NULL::text;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.broker_sign_in(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broker_sign_in(text, text) TO anon, authenticated;

-- "Ravi Kumar Realty" → "ravi-kumar-realty". Mirrors subdomainFromName in apps/web/src/lib/siteUrls.ts.
CREATE OR REPLACE FUNCTION public.subdomain_from_name(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '-', 'g'), '-')
$$;

-- Step 1 of registering: is this number allowed to? Returns
--   'not_invited'         FindHouse hasn't added this number
--   'not_active'          added, but blocked or inactive
--   'already_registered'  the broker already has a password: they should sign in
--   'invited'             go ahead: ask for name and password
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
  IF EXISTS (SELECT 1 FROM public.broker_credentials WHERE broker_id = b.id) THEN RETURN 'already_registered'; END IF;
  RETURN 'invited';
END;
$$;

REVOKE ALL ON FUNCTION public.broker_register_check(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broker_register_check(text) TO anon, authenticated;

-- Step 2: saves the name, the public site name (subdomain) made from it, and the password, and signs the broker in.
-- Outcomes: 'registered', 'not_invited', 'not_active', 'already_registered' (as above), plus
--   'weak_password'   shorter than 8 characters
--   'invalid_name'    the name doesn't make a usable site name (3 to 32 letters, digits and hyphens)
--   'name_reserved'   the site name belongs to FindHouse (www, admin …)
--   'name_taken'      another broker already has that site name
CREATE OR REPLACE FUNCTION public.broker_register(reg_phone text, reg_name text, reg_password text)
RETURNS TABLE (outcome text, id uuid, phone text, status text, name text, subdomain text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  b public.brokers%ROWTYPE;
  wanted text := public.subdomain_from_name(reg_name);
  check_result text := public.broker_register_check(reg_phone);
BEGIN
  IF check_result <> 'invited' THEN
    RETURN QUERY SELECT check_result, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  IF coalesce(length(reg_password), 0) < 8 THEN
    RETURN QUERY SELECT 'weak_password'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  IF wanted !~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$' THEN
    RETURN QUERY SELECT 'invalid_name'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  IF public.is_reserved_subdomain(wanted) THEN
    RETURN QUERY SELECT 'name_reserved'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT * INTO b FROM public.brokers WHERE brokers.phone = reg_phone FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.brokers o WHERE o.subdomain = wanted AND o.id <> b.id) THEN
    RETURN QUERY SELECT 'name_taken'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Two people registering at once: only the first gets in.
  INSERT INTO public.broker_credentials (broker_id, password_hash)
    VALUES (b.id, crypt(reg_password, gen_salt('bf')))
    ON CONFLICT (broker_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'already_registered'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  UPDATE public.brokers SET name = btrim(reg_name), subdomain = wanted WHERE brokers.id = b.id;

  RETURN QUERY SELECT 'registered'::text, b.id, b.phone, b.status::text, btrim(reg_name), wanted;
END;
$$;

REVOKE ALL ON FUNCTION public.broker_register(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broker_register(text, text, text) TO anon, authenticated;
