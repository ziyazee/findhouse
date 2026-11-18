-- Brokers table
CREATE TABLE public.brokers (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL DEFAULT '',
  email       text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- WhatsApp numbers registered to brokers
CREATE TABLE public.whatsapp_numbers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id      uuid NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  phone_number   text NOT NULL,
  is_verified    boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone_number)
);

-- Auto-create broker profile on auth.users insert (triggers in 005_triggers.sql)
