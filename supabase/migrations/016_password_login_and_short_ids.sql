-- 1. Password login for brokers (WhatsApp number + password).
-- 2. A short id on every listing, for links like ravi-homes.findhouse.in/k3f9x2ab/2bhk-in-andheri.
-- 3. A subdomain for brokers who have no name yet (they are created from their first WhatsApp message).
-- Run after 015_property_preview_image.sql, in the Supabase SQL editor.

-- ── 1. Passwords ───────────────────────────────────────────────────────────────────────────────────────────────
-- Hashes live in their own table that the public (anon) key can't read at all: RLS is on and there are no
-- policies. Only the SECURITY DEFINER functions below touch it.
CREATE TABLE IF NOT EXISTS public.broker_credentials (
  broker_id     uuid PRIMARY KEY REFERENCES public.brokers(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.broker_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.broker_credentials FROM anon, authenticated;
-- The admin page (a server-side function using the service key) reads it to show who has registered.
GRANT ALL ON public.broker_credentials TO service_role;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Signs a broker in. `outcome` is one of:
--   'ok'              password matched
--   'password_set'    the broker had no password yet, so this one was saved (first login)
--   'wrong_password'
--   'weak_password'   first login with a password shorter than 8 characters (nothing saved)
--   'no_account'      no broker with this number
--   'not_active'      the broker is INACTIVE or BLOCKED (see `status`)
-- To reset a broker's password, delete their row in broker_credentials: they choose a new one at next login.
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
    IF coalesce(length(login_password), 0) < 8 THEN
      RETURN QUERY SELECT 'weak_password'::text, b.id, b.phone, b.status::text, NULL::text;
      RETURN;
    END IF;
    INSERT INTO public.broker_credentials (broker_id, password_hash)
      VALUES (b.id, crypt(login_password, gen_salt('bf')))
      ON CONFLICT (broker_id) DO NOTHING;
    RETURN QUERY SELECT 'password_set'::text, b.id, b.phone, b.status::text, nullif(btrim(b.name), '');
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

-- ── 2. Short listing ids ───────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS short_id text;

-- 8 lowercase letters and digits, never confusable ones (0/o, 1/l).
CREATE OR REPLACE FUNCTION public.new_short_id()
RETURNS text
LANGUAGE plpgsql
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

-- Existing listings get one too; their old /p/<slug> links keep working.
UPDATE public.properties SET short_id = public.new_short_id() WHERE short_id IS NULL;

CREATE OR REPLACE FUNCTION public.properties_fill_short_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.short_id IS NULL THEN
    NEW.short_id := public.new_short_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS properties_fill_short_id ON public.properties;
CREATE TRIGGER properties_fill_short_id
  BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.properties_fill_short_id();

ALTER TABLE public.properties ALTER COLUMN short_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS properties_short_id_key ON public.properties(short_id);

-- ── 3. A subdomain even before the broker has a name ───────────────────────────────────────────────────────────
-- "broker-<last 4 digits>" (made unique with -2, -3 …). The broker can change it in Settings → Public site.
CREATE OR REPLACE FUNCTION public.brokers_fill_subdomain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subdomain IS NULL THEN
    NEW.subdomain := public.free_subdomain(
      coalesce(
        public.subdomain_base(NEW.name),
        'broker-' || right(regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g'), 4)
      ),
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Brokers who already exist without a subdomain.
DO $$
DECLARE
  b record;
BEGIN
  FOR b IN SELECT id, name, phone FROM public.brokers WHERE subdomain IS NULL ORDER BY created_at LOOP
    UPDATE public.brokers
      SET subdomain = public.free_subdomain(
        coalesce(
          public.subdomain_base(b.name),
          'broker-' || right(regexp_replace(coalesce(b.phone, ''), '\D', '', 'g'), 4)
        ),
        b.id
      )
      WHERE id = b.id;
  END LOOP;
END $$;
