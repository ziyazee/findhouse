// ============================================================
// preview-card — makes a listing's WhatsApp link preview image
// Self-contained (no imports from _shared): paste this whole file into the Supabase Dashboard editor.
//
// POST { propertyId } → crops the cover photo to 1200x630 (the size WhatsApp shows as a large, sharp card) and saves it
// as a JPEG under about 300 KB, saves it to R2 as
// previews/<slug>-<time>.jpg and stores that path in properties.preview_image_path. No text on it: WhatsApp
// shows the name and price itself, and text is unreadable once WhatsApp shrinks the image to a thumbnail.
// The listing page's preview tags (apps/web/functions/p/[slug].ts) point WhatsApp at it.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts'

// WhatsApp shows a large preview for a 1.91:1 image, and loads it reliably when it is under about 300 KB (the hard
// limit is 600 KB). So: full 1200x630, at the best quality that fits.
const WIDTH = 1200
const HEIGHT = 630
const TARGET_BYTES = 300_000
const QUALITIES = [86, 78, 70, 60, 50, 40]

// ── Image ─────────────────────────────────────────────────────────────────────

/**
 * The photo cropped to the preview shape as a small JPEG, at the best quality that fits TARGET_BYTES (the lowest
 * quality if none does). Null when there's no photo or it can't be read.
 */
export async function resizePhoto(photo: Uint8Array | null): Promise<Uint8Array<ArrayBuffer> | null> {
  const decoded = photo ? await Image.decode(photo).catch(() => null) : null
  if (!(decoded instanceof Image)) return null
  const small = decoded.cover(WIDTH, HEIGHT)
  let jpeg = new Uint8Array(0)
  for (const quality of QUALITIES) {
    jpeg = new Uint8Array(await small.encodeJPEG(quality))
    if (jpeg.length <= TARGET_BYTES) break
  }
  return jpeg as Uint8Array<ArrayBuffer>
}

// ── R2 upload (same signing as whatsapp-webhook) ──────────────────────────────

const encoder = new TextEncoder()

type Bytes = Uint8Array<ArrayBuffer>

async function hmacSha256(key: ArrayBuffer | Bytes, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, encoder.encode(data))
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha256 = async (data: Bytes) => toHex(await crypto.subtle.digest('SHA-256', data))

async function uploadToR2(key: string, body: Bytes, contentType: string): Promise<void> {
  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const bucket = Deno.env.get('R2_BUCKET_NAME') ?? 'findhouse-media'
  if (!accountId || !accessKeyId || !secretAccessKey) throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY is not set')

  const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`)
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const dateStamp = now.slice(0, 8)
  const payloadHash = await sha256(body)
  const headers: Record<string, string> = { 'content-type': contentType, host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': now }
  const names = Object.keys(headers).sort()
  const canonicalRequest = ['PUT', url.pathname, '', names.map((n) => `${n}:${headers[n]}\n`).join(''), names.join(';'), payloadHash].join('\n')
  const scope = `${dateStamp}/auto/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', now, scope, await sha256(encoder.encode(canonicalRequest))].join('\n')
  let signingKey = await hmacSha256(encoder.encode(`AWS4${secretAccessKey}`), dateStamp)
  for (const part of ['auto', 's3', 'aws4_request']) signingKey = await hmacSha256(signingKey, part)
  const signature = toHex(await hmacSha256(signingKey, stringToSign))

  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` },
    body,
  })
  if (!res.ok) throw new Error(`R2 upload failed (${res.status}): ${await res.text()}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Listing {
  slug: string
  property_media: Array<{ storage_path: string | null; media_type: string; is_cover: boolean | null; display_order: number | null }> | null
}

/** The cover photo, else the first photo; never a video. */
function coverPath(listing: Listing): string | null {
  const photos = (listing.property_media ?? [])
    .filter((m) => m.media_type !== 'video' && m.storage_path)
    .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || (a.display_order ?? 0) - (b.display_order ?? 0))
  return photos[0]?.storage_path ?? null
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let propertyId: string
  try {
    const body = await req.json() as { propertyId?: string }
    if (!body.propertyId) throw new Error('propertyId is required')
    propertyId = body.propertyId
  } catch (err) { return new Response(String(err), { status: 400 }) }

  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: listing, error } = await db
      .from('properties')
      .select('slug, property_media!property_media_property_id_fkey(storage_path, media_type, is_cover, display_order)')
      .eq('id', propertyId)
      .returns<Listing[]>()
      .maybeSingle()
    if (error) throw new Error(`Could not read listing: ${error.message}`)
    if (!listing) return new Response('Listing not found', { status: 404 })

    const mediaBase = (Deno.env.get('R2_PUBLIC_URL') ?? '').replace(/\/+$/, '')
    const cover = coverPath(listing)
    const photoRes = cover && mediaBase ? await fetch(`${mediaBase}/${cover}`).catch(() => null) : null
    const photo = photoRes?.ok ? new Uint8Array(await photoRes.arrayBuffer()) : null
    const jpeg = await resizePhoto(photo)
    if (!jpeg) {
      // The listing page falls back to the cover photo itself.
      console.warn(`[preview-card] No usable cover photo for ${listing.slug} (${cover ?? 'none'}) — no preview image made`)
      return new Response(JSON.stringify({ ok: true, path: null }), { headers: { 'Content-Type': 'application/json' } })
    }

    // A new name each time, so WhatsApp and the CDN never show an older card.
    const key = `previews/${listing.slug}-${Date.now().toString(36)}.jpg`
    await uploadToR2(key, jpeg, 'image/jpeg')
    const { error: saveError } = await db.from('properties').update({ preview_image_path: key }).eq('id', propertyId)
    if (saveError) throw new Error(`Could not save the preview image on the listing: ${saveError.message}`)

    console.log(`[preview-card] Made ${key} (${jpeg.length} bytes) for ${listing.slug}`)
    return new Response(JSON.stringify({ ok: true, path: key }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error(`[preview-card] Failed for ${propertyId}: ${reason}`)
    return new Response(JSON.stringify({ ok: false, error: reason }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
