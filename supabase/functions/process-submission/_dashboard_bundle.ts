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
      model: 'claude-haiku-5-5', max_tokens: 1024, system: EXTRACTION_PROMPT,
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

// ── Session manager ───────────────────────────────────────────────────────────

async function getSessionMessages(db: SupabaseClient, sessionId: string) {
  const { data, error } = await db
    .from('whatsapp_submission_messages')
    .select('message_type, text_body, media_storage_path, whatsapp_timestamp')
    .eq('submission_id', sessionId)
    .order('whatsapp_timestamp', { ascending: true, nullsFirst: false })
  if (error) throw new Error(`Failed to fetch messages: ${error.message}`)
  return (data ?? []).map((row) => ({
    message_type: row.message_type, content: row.text_body,
    storage_path: row.media_storage_path, received_at: row.whatsapp_timestamp ?? new Date().toISOString(),
  }))
}

async function completeSession(db: SupabaseClient, sessionId: string, propertyId: string): Promise<void> {
  const { error } = await db.from('whatsapp_submissions').update({ status: 'COMPLETED', property_id: propertyId, completed_at: new Date().toISOString() }).eq('id', sessionId)
  if (error) throw new Error(`Failed to complete submission: ${error.message}`)
}

async function failSession(db: SupabaseClient, sessionId: string, reason: string): Promise<void> {
  const { error } = await db.from('whatsapp_submissions').update({ status: 'FAILED', failure_reason: reason }).eq('id', sessionId)
  if (error) console.error(`[sessionManager] Failed to mark submission failed: ${error.message}`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  const safe = (title ?? 'untitled-property').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60)
  return `${safe || 'property'}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Broker replies (copy of the matching parts of _shared/conversation.ts) ────

const APP_URL = Deno.env.get('APP_URL') ?? 'https://findhouse.in'
const SITE_DOMAIN = Deno.env.get('SITE_DOMAIN') || undefined

function displayHost(appUrl: string): string {
  return appUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

function readyText(title: string, listingUrl: string, appUrl: string): string {
  return [
    'Your property website is ready! 🎉',
    '',
    `*${title}*`,
    listingUrl,
    '',
    `Share this link with your clients. To edit details or photos, sign in at ${displayHost(appUrl)} with this number.`,
  ].join('\n')
}

function failedText(): string {
  return 'Sorry, we couldn’t build that listing. Please send the photos and details again, then send *done*. This doesn’t use up your free listing.'
}

function listingUrl(slug: string, appUrl: string, siteDomain: string | undefined, subdomain: string | null | undefined): string {
  if (siteDomain && subdomain) return `https://${subdomain}.${siteDomain}/p/${slug}`
  return `${appUrl.replace(/\/+$/, '')}/p/${slug}`
}

async function sendText(to: string, body: string): Promise<void> {
  const waToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  if (!waToken || !waPhoneId) {
    console.warn('[process-submission] WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set — skipping reply')
    return
  }
  const res = await fetch(`https://graph.facebook.com/v19.0/${waPhoneId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  }).catch((err) => { console.error('[process-submission] WhatsApp reply failed:', err); return null })
  if (res && !res.ok) console.error(`[process-submission] WhatsApp reply failed: ${res.status} — ${await res.text()}`)
}

/** `*` so this still works before migration 012 (subdomain) has run. */
async function loadBroker(brokerId: string | null): Promise<{ plan: string | null; subdomain: string | null } | null> {
  if (!brokerId) return null
  const { data } = await db.from('brokers').select('*').eq('id', brokerId).maybeSingle()
  return data ? { plan: data.plan ?? null, subdomain: data.subdomain ?? null } : null
}

/** A failed build doesn't use up the free listing; tell a trial broker to send it again. */
async function tellTrialBrokerFailed(brokerId: string | null, phone: string): Promise<void> {
  const broker = await loadBroker(brokerId)
  if (broker?.plan === 'trial') await sendText(phone, failedText())
}

// ── Main ──────────────────────────────────────────────────────────────────────

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

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

  try {
    const messages = await getSessionMessages(db, sessionId)
    const propertyMessages = messages.filter((m) => m.message_type !== 'text' || (m.content && m.content.trim()))

    if (propertyMessages.length === 0) {
      await failSession(db, sessionId, 'No property information found in this submission.')
      await tellTrialBrokerFailed(session.broker_id, session.sender_phone)
      return new Response('No property content', { status: 422 })
    }

    console.log(`[process-submission] Processing ${propertyMessages.length} messages`)

    const extracted = await extractPropertyData(propertyMessages)
    extracted.title = extracted.title || 'Untitled Property'
    extracted.propertyType = extracted.propertyType || ''
    extracted.listingType = extracted.listingType || 'sale'
    extracted.amenities = extracted.amenities || []
    console.log(`[process-submission] Extracted: ${extracted.title}`)

    const mapLink = firstMapsLink(messages)
    if (mapLink) extracted.other = { ...(extracted.other ?? {}), mapLink }

    const slug = generateSlug(extracted.title)

    const { data: property, error: propertyError } = await db
      .from('properties')
      .insert({
        broker_id: session.broker_id, session_id: sessionId, slug,
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
      })
      .select('id, slug')
      .single()

    if (propertyError) throw new Error(`Property insert failed: ${propertyError.message}`)
    console.log(`[process-submission] Property created: ${property.id} (${property.slug})`)

    const mediaMessages = messages.filter((m) => (m.message_type === 'image' || m.message_type === 'video') && m.storage_path)
    if (mediaMessages.length > 0) {
      const mediaRows = mediaMessages.map((m, idx) => ({ property_id: property.id, media_type: m.message_type, storage_path: m.storage_path, display_order: idx, is_cover: idx === 0 }))
      const { error: mediaError } = await db.from('property_media').insert(mediaRows)
      if (mediaError) console.warn(`[process-submission] Media insert failed: ${mediaError.message}`)
    }

    await completeSession(db, sessionId, property.id)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // The free listing is used once it's built, before the broker hears about it, so their next message gets the plans.
    const broker = await loadBroker(session.broker_id)
    if (broker?.plan === 'trial') {
      const { error: trialError } = await db.from('brokers')
        .update({ trial_used_at: new Date().toISOString() })
        .eq('id', session.broker_id)
        .is('trial_used_at', null)
      if (trialError) console.error(`[process-submission] Could not mark trial used: ${trialError.message}`)
    }

    const url = listingUrl(property.slug, APP_URL, SITE_DOMAIN, broker?.subdomain)
    await sendText(session.sender_phone, readyText(extracted.title, url, APP_URL))

    fetch(`${supabaseUrl}/functions/v1/classify-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ propertyId: property.id }),
    }).catch((err) => console.error('[process-submission] Image classification failed:', err))

    return new Response(JSON.stringify({ ok: true, propertyId: property.id, slug: property.slug }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error(`[process-submission] Failed: ${reason}`)
    await failSession(db, sessionId, reason).catch(() => {})
    await tellTrialBrokerFailed(session.broker_id, session.sender_phone).catch(() => {})
    return new Response(JSON.stringify({ ok: false, error: reason }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
