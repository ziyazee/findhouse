// ============================================================
// preview-card — makes a listing's WhatsApp link preview image
// Self-contained (no imports from _shared): paste this whole file into the Supabase Dashboard editor.
//
// POST { propertyId } → draws the cover photo with a dark strip along the bottom holding the listing name and
// price, saves it to R2 as previews/<slug>-<time>.jpg and stores that path in properties.preview_image_path.
// The listing page's preview tags (apps/web/functions/p/[slug].ts) point WhatsApp at it.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts'

// WhatsApp shows a large preview for a 1.91:1 image under 600 KB.
const WIDTH = 1200
const HEIGHT = 630
const STRIP = 200
const PAD = 48
const NO_PHOTO_BACKGROUND = 0x1f2937ff

// Poppins has the ₹ sign.
const FONT_URL = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins'

// ── Card ──────────────────────────────────────────────────────────────────────

/** "₹47,000 a month" for rentals, "₹85 lakh" / "₹1.2 crore" for sales — the same words as the listing page. */
export function priceText(listingType: string | null, price: number | null): string | null {
  if (!price) return null
  if (listingType === 'rent') return `₹${Math.round(price).toLocaleString('en-IN')} a month`
  const round2 = (n: number) => Number(n.toFixed(2)).toString()
  if (price >= 1e7) return `₹${round2(price / 1e7)} crore`
  if (price >= 1e5) return `₹${round2(price / 1e5)} lakh`
  return `₹${price.toLocaleString('en-IN')}`
}

export interface Fonts { name: Uint8Array; price: Uint8Array }

/** One line of text, cut with "…" so it fits `maxWidth`. */
async function textLine(font: Uint8Array, size: number, text: string, maxWidth: number): Promise<Image> {
  let shown = text
  let line = await Image.renderText(font, size, shown, 0xffffffff)
  while (line.width > maxWidth && shown.length > 1) {
    shown = shown.slice(0, -1)
    line = await Image.renderText(font, size, `${shown.trimEnd()}…`, 0xffffffff)
  }
  return line
}

/** The card as a JPEG. Without a photo (or one that can't be read) the strip sits on a plain background. */
export async function drawCard(photo: Uint8Array | null, name: string, price: string | null, fonts: Fonts): Promise<Uint8Array<ArrayBuffer>> {
  const decoded = photo ? await Image.decode(photo).catch(() => null) : null
  const card = decoded instanceof Image ? decoded.cover(WIDTH, HEIGHT) : new Image(WIDTH, HEIGHT).fill(NO_PHOTO_BACKGROUND)
  card.composite(new Image(WIDTH, STRIP).fill(0x000000b8), 0, HEIGHT - STRIP)

  const lines = [await textLine(fonts.name, 52, name, WIDTH - PAD * 2)]
  if (price) lines.push(await textLine(fonts.price, 64, price, WIDTH - PAD * 2))
  let y = HEIGHT - STRIP + Math.round((STRIP - lines.reduce((h, l) => h + l.height, 0)) / 2)
  for (const line of lines) {
    card.composite(line, PAD, y)
    y += line.height
  }
  return new Uint8Array(await card.encodeJPEG(82))
}

let fontsLoading: Promise<Fonts> | null = null

function loadFonts(): Promise<Fonts> {
  const font = async (file: string) => {
    const res = await fetch(`${FONT_URL}/${file}`)
    if (!res.ok) throw new Error(`Could not load font ${file}: ${res.status}`)
    return new Uint8Array(await res.arrayBuffer())
  }
  fontsLoading ??= Promise.all([font('Poppins-SemiBold.ttf'), font('Poppins-Bold.ttf')])
    .then(([name, price]) => ({ name, price }))
    .catch((err) => { fontsLoading = null; throw err })
  return fontsLoading
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
  title: string | null
  slug: string
  listing_type: string | null
  price: number | null
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
      .select('title, slug, listing_type, price, property_media!property_media_property_id_fkey(storage_path, media_type, is_cover, display_order)')
      .eq('id', propertyId)
      .returns<Listing[]>()
      .maybeSingle()
    if (error) throw new Error(`Could not read listing: ${error.message}`)
    if (!listing) return new Response('Listing not found', { status: 404 })

    const mediaBase = (Deno.env.get('R2_PUBLIC_URL') ?? '').replace(/\/+$/, '')
    const cover = coverPath(listing)
    const photoRes = cover && mediaBase ? await fetch(`${mediaBase}/${cover}`).catch(() => null) : null
    const photo = photoRes?.ok ? new Uint8Array(await photoRes.arrayBuffer()) : null
    if (cover && !photo) console.warn(`[preview-card] Could not fetch the cover photo ${cover} — drawing the card without it`)

    const jpeg = await drawCard(photo, listing.title || 'Property on FindHouse', priceText(listing.listing_type, listing.price), await loadFonts())

    // A new name each time, so WhatsApp and the CDN never show an older card.
    const key = `previews/${listing.slug}-${Date.now().toString(36)}.jpg`
    await uploadToR2(key, jpeg, 'image/jpeg')
    const { error: saveError } = await db.from('properties').update({ preview_image_path: key }).eq('id', propertyId)
    if (saveError) throw new Error(`Could not save the card on the listing: ${saveError.message}`)

    console.log(`[preview-card] Made ${key} (${jpeg.length} bytes) for ${listing.slug}`)
    return new Response(JSON.stringify({ ok: true, path: key }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error(`[preview-card] Failed for ${propertyId}: ${reason}`)
    return new Response(JSON.stringify({ ok: false, error: reason }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
