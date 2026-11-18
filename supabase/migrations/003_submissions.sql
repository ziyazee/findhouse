-- Session and message enums
CREATE TYPE session_status AS ENUM ('IDLE', 'COLLECTING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE message_type AS ENUM ('text', 'image', 'video', 'document', 'audio');

-- Submission sessions
CREATE TABLE public.submission_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id         uuid NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  whatsapp_number   text NOT NULL,
  status            session_status NOT NULL DEFAULT 'COLLECTING',
  property_id       uuid REFERENCES public.properties(id),
  started_at        timestamptz NOT NULL DEFAULT now(),
  done_received_at  timestamptz,
  completed_at      timestamptz,
  failure_reason    text,
  retry_count       int NOT NULL DEFAULT 0
);

-- A broker can only have one active (COLLECTING) session at a time
CREATE UNIQUE INDEX one_active_session_per_broker
  ON public.submission_sessions (broker_id)
  WHERE status = 'COLLECTING';

-- Session messages
CREATE TABLE public.session_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL REFERENCES public.submission_sessions(id) ON DELETE CASCADE,
  broker_id      uuid NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  wa_message_id  text NOT NULL UNIQUE,   -- Prevents duplicate webhook events
  message_type   message_type NOT NULL,
  content        text,
  storage_path   text,
  wa_media_id    text,
  received_at    timestamptz NOT NULL DEFAULT now()
);

-- Add FK from properties back to sessions (deferred because sessions table didn't exist yet)
ALTER TABLE public.properties
  ADD CONSTRAINT properties_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.submission_sessions(id);
