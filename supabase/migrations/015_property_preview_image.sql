-- The WhatsApp link preview image the preview-card edge function makes for a listing (an R2 key under previews/).
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS preview_image_path text;
