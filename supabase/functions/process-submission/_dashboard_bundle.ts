// ============================================================
// process-submission — Dashboard bundle (single file, no imports from _shared)
// Paste this entire file into the Supabase Dashboard editor.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtractedProperty {
  title: string; propertyType: string; listingType: 'sale' | 'rent'
  price: number | null; deposit: number | null; location: string | null; locality: string | null
  bedrooms: number | null; bathrooms: number | null; balconies: number | null
  builtUpArea: number | null; carpetArea: number | null; furnishing: string | null
  floor: string | null; totalFloors: number | null; parking: string | null
  moveInDate: string | null; amenities: string[]; description: string | null
  other: Record<string, unknown> | null
}

// ── Map link ──────────────────────────────────────────────────────────────────

/** Keep in step with `MAPS_URL` in apps/web/src/modules/properties/listingExtras.ts. */
const MAPS_URL = /https?:\/\/(?:www\.)?(?:google\.[a-z.]{2,6}\/maps|maps\.google\.[a-z.]{2,6}|maps\.app\.goo\.gl|goo\.gl\/maps)[^\s"'<>]*/i

/** The first Google Maps link the broker sent: pasted in a message, or a location pin the webhook stored as one. */
function firstMapsLink(messages: Array<{ content: string | null }>): string | null {
  for (const m of messages) {
    const link = m.content && MAPS_URL.exec(m.content)?.[0].replace(/[.,;)\]]+$/, '')
    if (link) return link
  }
  return null
}

// ── AI extractor ──────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a real estate data extraction assistant. A property broker has sent you messages and media about a property via WhatsApp. Extract all available property information from the messages below and return it as valid JSON.

Rules:
- Never invent or guess missing information. Leave unavailable fields as null.
- If the broker did not mention a field, it must be null.
- Preserve the original values exactly (e.g. prices, area measurements).
- For amenities, return a flat array of strings (e.g. ["Swimming pool", "Gym", "Parking"]).
- For listingType: use "sale" if it's a property for sale/purchase, "rent" if it's for rent/lease.
- For description: write a concise 2-3 sentence summary using only information provided.
- propertyType examples: Apartment, Villa, Independent House, Plot, Commercial Space, Office, Shop, Warehouse.

Return ONLY valid JSON matching this exact schema. No other text:
{
  "title": "string — short descriptive title",
  "propertyType": "string",
  "listingType": "sale" | "rent",
  "price": number | null,
  "deposit": number | null,
  "location": "string — city or area" | null,
  "locality": "string — neighbourhood or street" | null,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "balconies": number | null,
  "builtUpArea": number | null,
  "carpetArea": number | null,
  "furnishing": "unfurnished" | "semi-furnished" | "fully-furnished" | null,
  "floor": "string" | null,
  "totalFloors": number | null,
  "parking": "string" | null,
  "moveInDate": "string — e.g. 'immediate', 'flexible', '1st January', 'flexible from immediate to 1 month'" | null,
  "amenities": ["string"],
  "description": "string" | null,
  "other": { "key": "value" } | null — any additional property details not covered above (e.g. facing direction, age of property, water supply, maintenance charge)
}

For rentals, when the broker mentions them, put these terms in "other" under exactly these keys:
- "preferredTenants": who the home is for, e.g. "Family", "Bachelors", "Company lease", "Anyone"
- "petsAllowed": true | false
- "nonVegAllowed": true | false
- "lockInPeriod": e.g. "11 months"
- "noticePeriod": e.g. "1 month"
- "brokerage": e.g. "1 month rent", "No brokerage"`

async function extractPropertyData(
  messages: Array<{ message_type: string; content: string | null; storage_path: string | null }>,
): Promise<ExtractedProperty> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const textMessages = messages.filter((m) => m.message_type === 'text' && m.content).map((m) => m.content!).join('\n\n')
  if (!textMessages) throw new Error('No text messages to extract from — session has no property information')

  const contentParts = [{ type: 'text', text: `Broker messages:\n${textMessages}` }]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-5-5', max_tokens: 4096, system: EXTRACTION_PROMPT,
      messages: [{ role: 'user', content: contentParts }],
    }),
  })

  if (!response.ok) { const err = await response.text(); throw new Error(`Claude API error ${response.status}: ${err}`) }

  const result = await response.json()
  const textBlock = (result.content ?? []).find((b: { type: string }) => b.type === 'text')
  const rawText: string = textBlock?.text ?? ''
  try {
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    return JSON.parse(jsonText) as ExtractedProperty
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${rawText.slice(0, 200)}`)
  }
}

// ── Session manager (copy of _shared/sessionManager.ts) ──────────────────────
// Open while COLLECTING and PROCESSING; closed when COMPLETED. close_submission (migration 022) shares the webhook's
// per-broker lock, so a message never falls between this listing and the next submission.

interface SessionMessage {
  message_type: string; content: string | null; storage_path: string | null
  media_status: 'none' | 'pending' | 'ready' | 'failed'; received_at: string; recorded_at: string
}

async function getSessionMessages(db: SupabaseClient, sessionId: string): Promise<SessionMessage[]> {
  const { data, error } = await db
    .from('whatsapp_submission_messages')
    .select('message_type, text_body, media_storage_path, media_status, whatsapp_timestamp, created_at')
    .eq('submission_id', sessionId)
    .order('whatsapp_timestamp', { ascending: true, nullsFirst: false })
  if (error) throw new Error(`Failed to fetch messages: ${error.message}`)
  return (data ?? []).map((row) => ({
    message_type: row.message_type, content: row.text_body, storage_path: row.media_storage_path,
    media_status: row.media_status ?? 'none',
    received_at: row.whatsapp_timestamp ?? new Date().toISOString(), recorded_at: row.created_at ?? new Date().toISOString(),
  }))
}

/** 'changed' when messages arrived beyond the `seen` the build has taken in; `seen` null closes regardless. */
async function closeSession(db: SupabaseClient, sessionId: string, propertyId: string, seen: number | null): Promise<'closed' | 'changed' | 'gone'> {
  const { data, error } = await db.rpc('close_submission', { p_submission_id: sessionId, p_property_id: propertyId, p_seen: seen })
  if (error) throw new Error(`Failed to close submission: ${error.message}`)
  return data as 'closed' | 'changed' | 'gone'
}

/** PROCESSING → COLLECTING: nothing to build from yet, so the broker can add to it and send "done" again. */
async function reopenSession(db: SupabaseClient, sessionId: string): Promise<void> {
  const { error } = await db.from('whatsapp_submissions').update({ status: 'COLLECTING', updated_at: new Date().toISOString() })
    .eq('id', sessionId).eq('status', 'PROCESSING')
  if (error) throw new Error(`Failed to reopen submission: ${error.message}`)
}

async function failSession(db: SupabaseClient, sessionId: string, reason: string): Promise<void> {
  const { error } = await db.from('whatsapp_submissions').update({ status: 'FAILED', failure_reason: reason }).eq('id', sessionId)
  if (error) console.error(`[sessionManager] Failed to mark submission failed: ${error.message}`)
}

/** Copy of isDoneText in _shared/messageClassifier.ts. */
function isDoneText(text: string): boolean {
  return /^done[.!,\s]*$/i.test(text.trim())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  const safe = (title ?? 'untitled-property').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60)
  return `${safe || 'property'}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Ready message (copy of listingUrl in _shared/conversation.ts) ──

const APP_URL = Deno.env.get('APP_URL') ?? 'https://findhouse.in'
const SITE_DOMAIN = Deno.env.get('SITE_DOMAIN') || 'findhouse.in'

/** A listing's name as it appears in its link: "2 BHK in Andheri!" → "2-bhk-in-andheri". Decoration only. */
function nameSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '')
}

/**
 * <broker>.<SITE_DOMAIN>/<shortId>/<name> when subdomains are on (SITE_DOMAIN) and the broker has one; otherwise the
 * same path on the main site. Keep in step with listingPath in apps/web/src/lib/siteUrls.ts.
 */
function listingUrl(listing: { shortId: string; title: string }, appUrl: string, siteDomain: string | undefined, subdomain: string | null | undefined): string {
  const name = nameSlug(listing.title)
  const path = name ? `/${listing.shortId}/${name}` : `/${listing.shortId}`
  if (siteDomain && subdomain) return `https://${subdomain}.${siteDomain}${path}`
  return `${appUrl.replace(/\/+$/, '')}${path}`
}

/** WhatsApp wants the full international number as digits only (919876543210): no +, spaces or dashes. */
function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null
}

/** WhatsApp draws the link preview card from the listing page's preview tags (apps/web/functions/p/[slug].ts). */
async function sendText(phone: string, body: string, preview = true): Promise<void> {
  await sendWA(phone, { type: 'text', text: { body, preview_url: preview } })
}

/** A message with one button that opens `url`, so the link itself isn't shown. `label` is at most 20 characters. */
async function sendButton(phone: string, body: string, label: string, url: string): Promise<void> {
  await sendWA(phone, {
    type: 'interactive',
    interactive: { type: 'cta_url', body: { text: body }, action: { name: 'cta_url', parameters: { display_text: label, url } } },
  })
}

async function sendWA(phone: string, message: Record<string, unknown>): Promise<void> {
  const waToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  if (!waToken || !waPhoneId) {
    console.warn('[process-submission] WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set — skipping reply')
    return
  }
  const to = normalizePhone(phone)
  if (!to) {
    console.error(`[process-submission] Not a valid international phone number: "${phone}" — skipping reply`)
    return
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${waPhoneId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, ...message }),
  }).catch((err) => { console.error('[process-submission] WhatsApp reply failed:', err); return null })
  if (!res) return
  const answer = await res.text()
  if (!res.ok) {
    console.error(`[process-submission] WhatsApp reply failed: ${res.status} — ${answer}`)
    return
  }
  // Accepted is not delivered: the outcome arrives later as a delivery status, which whatsapp-webhook logs.
  console.log(`[process-submission] WhatsApp accepted the reply to ${to}: ${answer}`)
}

/** Before the link is sent, so WhatsApp finds the card. If it fails the link still goes; the preview shows the cover photo. */
async function makePreviewCard(propertyId: string, timeoutMs: number): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/preview-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ propertyId }),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((err) => { console.error('[process-submission] preview-card failed:', err); return null })
  if (res && !res.ok) console.error(`[process-submission] preview-card answered ${res.status}: ${await res.text()}`)
}

/**
 * Sorts the photos not sorted yet into rooms (the first batch also picks the cover photo). If it fails or runs long
 * we carry on anyway: the reply must not be lost.
 */
async function classifyImages(propertyId: string, timeoutMs: number): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/classify-images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ propertyId }),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((err) => { console.error('[process-submission] Image classification failed:', err); return null })
  if (res && !res.ok) console.error(`[process-submission] classify-images answered ${res.status}: ${await res.text()}`)
}

async function loadBroker(brokerId: string | null): Promise<{ subdomain: string | null } | null> {
  if (!brokerId) return null
  const { data } = await db.from('brokers').select('subdomain').eq('id', brokerId).maybeSingle()
  return data ? { subdomain: data.subdomain ?? null } : null
}

// ── Main ──────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = createClient(SUPABASE_URL, SERVICE_KEY)

/** The listing takes messages for at least this long after "done", whether or not it is ready sooner. */
const OPEN_MS = 30_000
/** A photo still downloading this long after it reached us is given up on. */
const MEDIA_WAIT_MS = 60_000
/** Everything, reply included, has to fit in the edge function's time limit (150 s on the free plan). */
const BUDGET_MS = 140_000
/** Time kept back at the end for the preview card and the reply. */
const FINISH_MS = 35_000
const POLL_MS = 2_000

/** Keeps the function alive for the build after it has answered the webhook. */
function runInBackground(task: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
  runtime?.waitUntil(task)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Session = { id: string; broker_id: string | null; sender_phone: string }

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let sessionId: string
  try {
    const body = await req.json() as { sessionId?: string }
    if (!body.sessionId) throw new Error('sessionId is required')
    sessionId = body.sessionId
  } catch (err) { return new Response(String(err), { status: 400 }) }

  console.log(`[process-submission] Starting for session: ${sessionId}`)

  const { data: session, error: sessionError } = await db
    .from('whatsapp_submissions')
    .select('id, broker_id, sender_phone, status')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) return new Response('Submission not found', { status: 404 })

  if (session.status !== 'PROCESSING') {
    console.warn(`[process-submission] Submission ${sessionId} is ${session.status}, skipping`)
    return new Response('Submission is not in PROCESSING state', { status: 409 })
  }

  // Answer now: the build takes at least OPEN_MS, and the webhook shouldn't be held open for it.
  runInBackground(build(session).catch((err) => console.error('[process-submission] Build crashed:', err)))
  return new Response(JSON.stringify({ ok: true, building: sessionId }), { status: 202, headers: { 'Content-Type': 'application/json' } })
})

/**
 * Builds the listing from what the broker has sent, taking in whatever else arrives, until all of these hold:
 * OPEN_MS have passed since "done", no photo is still downloading, and nothing new arrived since the last look.
 * Then the submission closes (later messages start the next one) and the broker gets the links.
 */
async function build(session: Session): Promise<void> {
  const startedAt = Date.now()
  const elapsed = () => Date.now() - startedAt
  const left = () => BUDGET_MS - elapsed()

  let property: { id: string; short_id: string } | null = null
  let extracted: ExtractedProperty | null = null
  let textsRead = 0
  const attached = new Set<string>()
  let unsorted = false
  let previewedAt = -1

  try {
    while (true) {
      const messages = await getSessionMessages(db, session.id)
      const open = elapsed() < OPEN_MS
      const outOfTime = left() <= FINISH_MS
      const downloading = messages.some(
        (m) => m.media_status === 'pending' && Date.now() - Date.parse(m.recorded_at) < MEDIA_WAIT_MS,
      )

      // ── Details: read as soon as there is text, and again whenever more arrives
      const texts = messages.filter(isDetail).length
      if (texts > textsRead) {
        textsRead = texts
        extracted = await extractPropertyData(contentOf(messages))
        property = await saveProperty(session, property, extracted, messages)
      }

      // ── Photos and videos that have finished downloading
      if (property) {
        const fresh = messages.filter(
          (m) => (m.message_type === 'image' || m.message_type === 'video') && m.storage_path && !attached.has(m.storage_path),
        )
        if (fresh.length && await attachMedia(property.id, fresh, attached.size)) {
          for (const m of fresh) attached.add(m.storage_path!)
          unsorted = unsorted || fresh.some((m) => m.message_type === 'image')
        }
        // Sorted while the listing is still open, so little is left to do at the end.
        if (unsorted && left() - FINISH_MS > 5_000) {
          unsorted = false
          await classifyImages(property.id, Math.min(110_000, left() - FINISH_MS))
        }
      }

      if ((open || downloading) && !outOfTime) {
        await sleep(POLL_MS)
        continue
      }

      // No details to build from: keep what was sent and let the broker add to it.
      if (!property) {
        await reopenSession(db, session.id)
        const photos = messages.some((m) => m.storage_path)
        await sendText(session.sender_phone, photos
          ? 'Got your photos. Now send the details (rent or price, location, size), then send "done".'
          : 'We did not get any photos or details. Send them, then send "done".', false)
        return
      }

      if (previewedAt !== attached.size) {
        previewedAt = attached.size
        await makePreviewCard(property.id, Math.max(5_000, Math.min(25_000, left() - 10_000)))
      }

      // Closes only if nothing arrived since `messages` was read; otherwise go round once more to take it in.
      const closed = await closeSession(db, session.id, property.id, outOfTime ? null : messages.length)
      if (closed === 'changed') continue
      if (closed === 'gone') {
        console.warn(`[process-submission] Submission ${session.id} is no longer being built — no reply sent`)
        return
      }
      break
    }

    console.log(`[process-submission] Listing ${property.id} ready after ${Math.round(elapsed() / 1000)} s`)
    const broker = await loadBroker(session.broker_id)
    // Two messages, in this order: the listing link alone, so WhatsApp shows its preview card, then a button to
    // manage it in the workspace.
    await sendText(session.sender_phone, listingUrl({ shortId: property.short_id, title: extracted!.title }, APP_URL, SITE_DOMAIN, broker?.subdomain))
    await sendButton(session.sender_phone, 'Manage your website here', 'Manage website', `${APP_URL.replace(/\/+$/, '')}/properties/${property.id}`)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error(`[process-submission] Failed: ${reason}`)
    await failSession(db, session.id, reason).catch(() => {})
    await sendText(session.sender_phone, 'Something went wrong while building your listing. Please send the photos and details again, then "done".', false)
  }
}

/** A text the broker wrote about the property: not empty, and not the "done" that closed it. */
function isDetail(m: SessionMessage): boolean {
  return m.message_type === 'text' && !!m.content?.trim() && !isDoneText(m.content)
}

/** What the extractor reads: the broker's texts and the photos that have been stored. */
function contentOf(messages: SessionMessage[]): SessionMessage[] {
  return messages.filter((m) => (m.message_type === 'text' ? isDetail(m) : m.storage_path))
}

/** Creates the property the first time, and updates its details when more text arrives later. */
async function saveProperty(
  session: Session,
  existing: { id: string; short_id: string } | null,
  extracted: ExtractedProperty,
  messages: SessionMessage[],
): Promise<{ id: string; short_id: string }> {
  extracted.title = extracted.title || 'Untitled Property'
  extracted.propertyType = extracted.propertyType || ''
  extracted.listingType = extracted.listingType || 'sale'
  extracted.amenities = extracted.amenities || []
  const mapLink = firstMapsLink(messages)
  if (mapLink) extracted.other = { ...(extracted.other ?? {}), mapLink }
  console.log(`[process-submission] Extracted: ${extracted.title}`)

  const details = {
    title: extracted.title, property_type: extracted.propertyType,
    listing_type: extracted.listingType, price: extracted.price, deposit: extracted.deposit,
    location: extracted.location, locality: extracted.locality,
    bedrooms: extracted.bedrooms, bathrooms: extracted.bathrooms, balconies: extracted.balconies,
    built_up_area: extracted.builtUpArea, carpet_area: extracted.carpetArea,
    furnishing: extracted.furnishing, floor: extracted.floor,
    total_floors: extracted.totalFloors, parking: extracted.parking,
    move_in_date: extracted.moveInDate,
    amenities: extracted.amenities, description: extracted.description,
    other: extracted.other ?? {}, raw_data: extracted,
  }

  if (existing) {
    const { error } = await db.from('properties').update(details).eq('id', existing.id)
    if (error) throw new Error(`Property update failed: ${error.message}`)
    console.log(`[process-submission] Details updated from later messages: ${existing.id}`)
    return existing
  }

  const { data, error } = await db
    .from('properties')
    .insert({ broker_id: session.broker_id, session_id: session.id, slug: generateSlug(extracted.title), ...details })
    .select('id, slug, short_id')
    .single()

  if (error) throw new Error(`Property insert failed: ${error.message}`)
  console.log(`[process-submission] Property created: ${data.id} (${data.slug})`)
  return data
}

/** Adds photos and videos after the ones already on the listing. The very first one is the cover until sorting picks one. */
async function attachMedia(propertyId: string, media: SessionMessage[], already: number): Promise<boolean> {
  const rows = media.map((m, idx) => ({
    property_id: propertyId, media_type: m.message_type, storage_path: m.storage_path,
    display_order: already + idx, is_cover: already === 0 && idx === 0,
  }))
  const { error } = await db.from('property_media').insert(rows)
  if (error) {
    console.warn(`[process-submission] Media insert failed, trying again next round: ${error.message}`)
    return false
  }
  console.log(`[process-submission] Attached ${rows.length} photo(s)/video(s) to ${propertyId}`)
  return true
}
