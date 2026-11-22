-- whatsapp-webhook stamps updated_at when a submission moves to PROCESSING, and a trial broker's number stays
-- quiet only while that stamp is under 10 minutes old. The live table never had the column.
ALTER TABLE public.whatsapp_submissions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
