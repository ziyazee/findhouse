-- Each broker's public site lives on a subdomain: ravi-homes.findhouse.in shows their public listings, and
-- ravi-homes.findhouse.in/p/<slug> each listing. Run after 011_listing_visibility.sql.
--
-- The subdomain is made from the broker's name when there is one (made unique with -2, -3 …), and the broker can
-- change it in Settings. Renaming the broker doesn't change it, so links already shared keep working.
-- 3 to 32 characters: lowercase letters, digits and hyphens, starting and ending with a letter or digit.

ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS subdomain text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brokers_subdomain_format') THEN
    ALTER TABLE public.brokers
      ADD CONSTRAINT brokers_subdomain_format CHECK (subdomain ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS brokers_subdomain_key ON public.brokers(subdomain);

-- Names that belong to FindHouse itself. Keep in step with RESERVED_SUBDOMAINS in apps/web/src/lib/site.ts.
CREATE OR REPLACE FUNCTION public.is_reserved_subdomain(candidate text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT candidate = ANY (ARRAY[
    'www', 'app', 'api', 'admin', 'dashboard', 'login', 'auth', 'mail', 'email', 'smtp', 'ftp', 'cdn', 'static',
    'assets', 'media', 'img', 'images', 'files', 'help', 'support', 'docs', 'blog', 'status', 'dev', 'staging',
    'test', 'demo', 'beta', 'findhouse', 'broker', 'brokers', 'agent', 'agents', 'about', 'contact', 'terms',
    'privacy', 'legal', 'billing', 'pay', 'payments', 'account', 'settings', 'webhook', 'webhooks', 'whatsapp'
  ])
$$;

-- "Ravi Kumar Realty" → "ravi-kumar-realty"; null when nothing usable is left.
CREATE OR REPLACE FUNCTION public.subdomain_base(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN length(s) >= 3 THEN s END
  FROM (
    SELECT btrim(left(btrim(regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '-', 'g'), '-'), 28), '-') AS s
  ) t
$$;

-- `base`, or `base-2`, `base-3` … : the first one no other broker has and FindHouse hasn't reserved.
CREATE OR REPLACE FUNCTION public.free_subdomain(base text, owner uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  candidate text := base;
  n int := 1;
BEGIN
  IF base IS NULL THEN RETURN NULL; END IF;
  LOOP
    IF NOT public.is_reserved_subdomain(candidate)
       AND NOT EXISTS (SELECT 1 FROM public.brokers WHERE subdomain = candidate AND id <> owner) THEN
      RETURN candidate;
    END IF;
    n := n + 1;
    candidate := base || '-' || n;
  END LOOP;
END;
$$;

-- New brokers, and brokers who get a name later, get a subdomain automatically.
CREATE OR REPLACE FUNCTION public.brokers_fill_subdomain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subdomain IS NULL THEN
    NEW.subdomain := public.free_subdomain(public.subdomain_base(NEW.name), NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS brokers_fill_subdomain ON public.brokers;
CREATE TRIGGER brokers_fill_subdomain
  BEFORE INSERT OR UPDATE OF name ON public.brokers
  FOR EACH ROW EXECUTE FUNCTION public.brokers_fill_subdomain();

-- Existing brokers, oldest first so the earliest broker keeps the plain name.
DO $$
DECLARE
  b record;
BEGIN
  FOR b IN SELECT id, name FROM public.brokers WHERE subdomain IS NULL ORDER BY created_at LOOP
    UPDATE public.brokers
      SET subdomain = public.free_subdomain(public.subdomain_base(b.name), b.id)
      WHERE id = b.id;
  END LOOP;
END $$;

-- The broker page, looked up by id (/b/:id) or by subdomain. No row unless the broker is ACTIVE.
DROP FUNCTION IF EXISTS public.get_broker_page(uuid);
CREATE OR REPLACE FUNCTION public.get_broker_page(page_broker_id uuid DEFAULT NULL, page_subdomain text DEFAULT NULL)
RETURNS TABLE (id uuid, name text, phone text, subdomain text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, NULLIF(btrim(b.name), ''), b.phone, b.subdomain
  FROM public.brokers b
  WHERE b.status = 'ACTIVE'
    AND (b.id = page_broker_id OR b.subdomain = lower(btrim(page_subdomain)))
$$;

REVOKE ALL ON FUNCTION public.get_broker_page(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_broker_page(uuid, text) TO anon, authenticated;

-- Changes a broker's subdomain. Errors: 22023 with message 'invalid' or 'reserved', 23505 when it's taken.
CREATE OR REPLACE FUNCTION public.set_broker_subdomain(page_broker_id uuid, new_subdomain text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wanted text := lower(btrim(new_subdomain));
BEGIN
  IF wanted !~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$' OR wanted LIKE '%--%' THEN
    RAISE EXCEPTION 'invalid' USING ERRCODE = '22023';
  END IF;
  IF public.is_reserved_subdomain(wanted) THEN
    RAISE EXCEPTION 'reserved' USING ERRCODE = '22023';
  END IF;
  UPDATE public.brokers SET subdomain = wanted WHERE id = page_broker_id AND status = 'ACTIVE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active broker' USING ERRCODE = 'P0002';
  END IF;
  RETURN wanted;
END;
$$;

REVOKE ALL ON FUNCTION public.set_broker_subdomain(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_broker_subdomain(uuid, text) TO anon, authenticated;
