-- Reviews of a broker, left by visitors on the broker's public page. Run after 020.
--   • Anyone can leave a review (star rating 1–5, their name, optional comment) — no account needed.
--   • One review per browser per broker: the page sends a random device id, and sending again edits that review.
--     That stops casual repeat-posting; it isn't proof of a real client, so the page says "reviews from visitors".
--   • A broker can't review themselves.
--   • Reviews are public at once. A broker can delete any review on their page (delete_my_broker_review). It is
--     hidden rather than erased, so the same browser can't just post it again: sending again keeps it hidden.
-- The table is closed to every key; the page uses the two functions below.

CREATE TABLE IF NOT EXISTS public.broker_reviews (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  broker_id   uuid NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  device_id   text NOT NULL CHECK (char_length(device_id) BETWEEN 8 AND 64),
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text CHECK (comment IS NULL OR char_length(comment) <= 600),
  author_name text CHECK (author_name IS NULL OR char_length(author_name) <= 60),
  status      text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_id, device_id)
);
CREATE INDEX IF NOT EXISTS broker_reviews_broker_time ON public.broker_reviews (broker_id, created_at DESC);

ALTER TABLE public.broker_reviews ENABLE ROW LEVEL SECURITY;

-- Saves a review (or updates this device's earlier one). Returns nothing; errors use code 22023 with a short reason.
CREATE OR REPLACE FUNCTION public.submit_broker_review(
  page_broker_id uuid,
  device text,
  stars integer,
  review_comment text DEFAULT NULL,
  reviewer_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_comment text := NULLIF(btrim(review_comment), '');
  clean_name text := NULLIF(btrim(reviewer_name), '');
BEGIN
  IF stars IS NULL OR stars NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'rating' USING ERRCODE = '22023';
  END IF;
  IF device IS NULL OR char_length(device) NOT BETWEEN 8 AND 64 THEN
    RAISE EXCEPTION 'device' USING ERRCODE = '22023';
  END IF;
  IF clean_name IS NULL THEN
    RAISE EXCEPTION 'name' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(clean_comment, '')) > 600 OR char_length(coalesce(clean_name, '')) > 60 THEN
    RAISE EXCEPTION 'too_long' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.brokers WHERE id = page_broker_id AND status = 'ACTIVE') THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '22023';
  END IF;
  IF page_broker_id = public.current_broker_id() THEN
    RAISE EXCEPTION 'own_page' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.broker_reviews (broker_id, device_id, rating, comment, author_name)
  VALUES (page_broker_id, device, stars, clean_comment, clean_name)
  ON CONFLICT (broker_id, device_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        author_name = EXCLUDED.author_name,
        updated_at = now();
END
$$;
REVOKE ALL ON FUNCTION public.submit_broker_review(uuid, text, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_broker_review(uuid, text, integer, text, text) TO anon, authenticated;

-- The average, the count per star, and the newest reviews (up to `max_rows`) of an active broker.
-- When `device` is given, `mine` is that device's own review (so the page can show "your review" and let them edit).
CREATE OR REPLACE FUNCTION public.get_broker_reviews(page_broker_id uuid, device text DEFAULT NULL, max_rows integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'count', (SELECT count(*) FROM public.broker_reviews r WHERE r.broker_id = b.id AND r.status = 'published'),
    'average', (SELECT round(avg(r.rating)::numeric, 1) FROM public.broker_reviews r WHERE r.broker_id = b.id AND r.status = 'published'),
    'stars', jsonb_build_object(
      '1', (SELECT count(*) FROM public.broker_reviews r WHERE r.broker_id = b.id AND r.status = 'published' AND r.rating = 1),
      '2', (SELECT count(*) FROM public.broker_reviews r WHERE r.broker_id = b.id AND r.status = 'published' AND r.rating = 2),
      '3', (SELECT count(*) FROM public.broker_reviews r WHERE r.broker_id = b.id AND r.status = 'published' AND r.rating = 3),
      '4', (SELECT count(*) FROM public.broker_reviews r WHERE r.broker_id = b.id AND r.status = 'published' AND r.rating = 4),
      '5', (SELECT count(*) FROM public.broker_reviews r WHERE r.broker_id = b.id AND r.status = 'published' AND r.rating = 5)
    ),
    'reviews', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x.id, 'rating', x.rating, 'comment', x.comment, 'name', x.author_name, 'created_at', x.created_at
      ) ORDER BY x.created_at DESC)
      FROM (
        SELECT r.* FROM public.broker_reviews r
        WHERE r.broker_id = b.id AND r.status = 'published'
        ORDER BY r.created_at DESC
        LIMIT least(greatest(max_rows, 1), 100)
      ) x
    ), '[]'::jsonb),
    'mine', (
      SELECT jsonb_build_object('rating', r.rating, 'comment', r.comment, 'name', r.author_name)
      FROM public.broker_reviews r
      WHERE device IS NOT NULL AND r.broker_id = b.id AND r.device_id = device
    )
  )
  FROM public.brokers b
  WHERE b.id = page_broker_id AND b.status = 'ACTIVE'
$$;
REVOKE ALL ON FUNCTION public.get_broker_reviews(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_broker_reviews(uuid, text, integer) TO anon, authenticated;

-- The signed-in broker deletes a review on their own page. Returns true if one was removed.
CREATE OR REPLACE FUNCTION public.delete_my_broker_review(review_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.broker_reviews
     SET status = 'hidden', updated_at = now()
   WHERE id = review_id
     AND broker_id = public.current_broker_id()
     AND status = 'published';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END
$$;
REVOKE ALL ON FUNCTION public.delete_my_broker_review(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_broker_review(bigint) TO authenticated;
