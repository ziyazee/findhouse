-- "done" starts building the listing straight away, and the submission keeps taking the broker's messages until the
-- reply with the link goes out. A photo sent before "done" can reach us after it (it uploads slower than a text).
--   • A message is recorded the moment it arrives; its photo or video is fetched afterwards (media_status).
--   • COLLECTING and PROCESSING submissions are both open. COMPLETED is closed: later messages start a new one.
--   • Recording a message and closing a submission take the same per-broker lock, so a message that arrives
--     while the submission closes lands in exactly one place: this listing, or the next submission.

ALTER TABLE public.whatsapp_submission_messages
  ADD COLUMN IF NOT EXISTS media_status text NOT NULL DEFAULT 'none'
    CHECK (media_status IN ('none', 'pending', 'ready', 'failed'));
UPDATE public.whatsapp_submission_messages SET media_status = 'ready'
  WHERE media_storage_path IS NOT NULL AND media_status = 'none';

-- Records one message in the broker's open submission, opening one if there is none and p_may_open allows it.
-- A PROCESSING submission untouched for 10 minutes was abandoned by a failed build and no longer counts as open.
-- Returns no row when the message was not recorded: nothing open and not allowed to open, or already recorded.
CREATE OR REPLACE FUNCTION public.record_submission_message(
  p_broker_id    uuid,
  p_sender_phone text,
  p_may_open     boolean,
  p_message      jsonb
)
RETURNS TABLE (submission_id uuid, submission_status text)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id     uuid;
  v_status text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('whatsapp_submission:' || p_broker_id::text));

  SELECT s.id, s.status INTO v_id, v_status
  FROM public.whatsapp_submissions s
  WHERE s.broker_id = p_broker_id
    AND (s.status = 'COLLECTING' OR (s.status = 'PROCESSING' AND s.updated_at > now() - interval '10 minutes'))
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    IF NOT p_may_open THEN RETURN; END IF;
    INSERT INTO public.whatsapp_submissions (broker_id, sender_phone, status)
    VALUES (p_broker_id, p_sender_phone, 'COLLECTING')
    RETURNING id, status INTO v_id, v_status;
  END IF;

  BEGIN
    INSERT INTO public.whatsapp_submission_messages (
      submission_id, whatsapp_message_id, message_type, text_body, caption,
      media_id, media_type, mime_type, media_status, whatsapp_timestamp
    ) VALUES (
      v_id,
      p_message->>'whatsapp_message_id',
      p_message->>'message_type',
      p_message->>'text_body',
      p_message->>'caption',
      p_message->>'media_id',
      p_message->>'media_type',
      p_message->>'mime_type',
      COALESCE(p_message->>'media_status', 'none'),
      (p_message->>'whatsapp_timestamp')::timestamptz
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN;  -- WhatsApp delivered the same message twice
  END;

  RETURN QUERY SELECT v_id, v_status;
END
$$;
REVOKE ALL ON FUNCTION public.record_submission_message(uuid, text, boolean, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_submission_message(uuid, text, boolean, jsonb) TO service_role;

-- Closes a PROCESSING submission once the listing is ready to send, and uses up a trial broker's free listing.
--   'closed'  — done; messages from now on start a new submission.
--   'changed' — messages arrived since the build last looked (it held p_seen of them); it should take them in first.
--   'gone'    — the submission is not PROCESSING any more.
-- p_seen NULL closes whatever has arrived (the build ran out of time).
CREATE OR REPLACE FUNCTION public.close_submission(p_submission_id uuid, p_property_id uuid, p_seen integer)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_broker uuid;
  v_status text;
  v_count  integer;
BEGIN
  SELECT broker_id INTO v_broker FROM public.whatsapp_submissions WHERE id = p_submission_id;
  IF v_broker IS NULL THEN RETURN 'gone'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('whatsapp_submission:' || v_broker::text));

  SELECT status INTO v_status FROM public.whatsapp_submissions WHERE id = p_submission_id;
  IF v_status IS DISTINCT FROM 'PROCESSING' THEN RETURN 'gone'; END IF;

  IF p_seen IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.whatsapp_submission_messages WHERE submission_id = p_submission_id;
    IF v_count <> p_seen THEN RETURN 'changed'; END IF;
  END IF;

  UPDATE public.whatsapp_submissions
  SET status = 'COMPLETED', property_id = p_property_id, completed_at = now(), updated_at = now()
  WHERE id = p_submission_id;

  UPDATE public.brokers SET trial_used_at = now()
  WHERE id = v_broker AND plan = 'trial' AND trial_used_at IS NULL;

  RETURN 'closed';
END
$$;
REVOKE ALL ON FUNCTION public.close_submission(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_submission(uuid, uuid, integer) TO service_role;
