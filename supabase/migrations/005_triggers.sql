-- Auto-create broker profile when a new user signs up.
-- Also sets the "broker" role claim in app_metadata.
-- Admin accounts are created manually and already have role = "admin",
-- so this trigger skips them.

CREATE OR REPLACE FUNCTION public.handle_new_broker()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Skip admin accounts
  IF (NEW.raw_app_meta_data->>'role') = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Create broker profile
  INSERT INTO public.brokers (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Set broker role claim (server-side, not user-editable)
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "broker"}'::jsonb
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_broker();
