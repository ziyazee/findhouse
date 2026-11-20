-- Free trial over WhatsApp.
-- A new number gets a welcome, then one free listing. After that every message gets a "trial is over" reply with
-- the plans, at most five times. Brokers who existed before this migration are paid and keep working as before.
-- Run this before deploying the whatsapp-webhook and process-submission bundles that use it.

-- 'trial' or 'paid'. Existing rows become 'paid'; new rows start as 'trial'.
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'paid';
ALTER TABLE public.brokers ALTER COLUMN plan SET DEFAULT 'trial';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brokers_plan_check') THEN
    ALTER TABLE public.brokers ADD CONSTRAINT brokers_plan_check CHECK (plan IN ('trial', 'paid'));
  END IF;
END $$;

-- When the welcome went out, and when the free listing was built (null until then; a failed build doesn't count).
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS welcomed_at timestamptz;
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS trial_used_at timestamptz;
-- How many "trial is over" replies have gone out (capped at 5).
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS trial_over_replies int NOT NULL DEFAULT 0;
-- The broker's latest WhatsApp message, and the latest one we answered, so a burst of messages gets one reply.
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS last_inbound_message_id text;
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS last_reply_message_id text;

-- Claims the right to answer `message_id` with an automatic reply of `reply_kind`. True only when:
--   it is still the broker's latest message (nothing newer arrived while we waited),
--   nothing has answered it yet (Meta can deliver a message twice),
--   a welcome hasn't gone out before ('welcome'), and fewer than 5 trial-over replies have ('trial_over').
-- Claiming records the reply, so call it right before sending.
CREATE OR REPLACE FUNCTION public.claim_auto_reply(claim_broker_id uuid, message_id text, reply_kind text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.brokers
  SET last_reply_message_id = message_id,
      welcomed_at = CASE WHEN reply_kind = 'welcome' THEN now() ELSE welcomed_at END,
      trial_over_replies = trial_over_replies + CASE WHEN reply_kind = 'trial_over' THEN 1 ELSE 0 END
  WHERE id = claim_broker_id
    AND last_inbound_message_id = message_id
    AND last_reply_message_id IS DISTINCT FROM message_id
    AND (reply_kind <> 'welcome' OR welcomed_at IS NULL)
    AND (reply_kind <> 'trial_over' OR trial_over_replies < 5);
  RETURN FOUND;
END;
$$;

-- Edge functions use the service role; nobody else may call this.
REVOKE ALL ON FUNCTION public.claim_auto_reply(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_auto_reply(uuid, text, text) TO service_role;
