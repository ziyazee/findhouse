// ============================================================
// whatsapp-webhook — Dashboard bundle (single file, no imports from _shared)
// Paste this entire file into the Supabase Dashboard editor.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ─────────────────────────────────────────────────────────────────────

type MessageClassification = 'GREETING' | 'DONE' | 'PROPERTY_INFO' | 'OTHER'
type MessageType = 'text' | 'image' | 'video' | 'document' | 'audio' | 'location'
type BrokerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED'

interface WAWebhookPayload {
  object: string
  entry: WAEntry[]
}
interface WAEntry { id: string; changes: WAChange[] }
interface WAChange { value: WAChangeValue; field: string }
interface WAChangeValue {
  messaging_product: string
  metadata: { display_phone_number: string; phone_number_id: string }
  contacts?: WAContact[]
  messages?: WAMessage[]
  statuses?: unknown[]
}
interface WAContact { profile: { name: string }; wa_id: string }
interface WAMessage {
  from: string; id: string; timestamp: string; type: MessageType
  text?: { body: string }
  image?: { id: string; mime_type: string; sha256: string; caption?: string }
  video?: { id: string; mime_type: string; sha256: string }
  document?: { id: string; mime_type: string; filename?: string }
  audio?: { id: string; mime_type: string }
  location?: WALocation
}
/** A location pin the broker shared from WhatsApp's attachment menu. */
interface WALocation { latitude: number; longitude: number; name?: string; address?: string }
interface ParsedMessage {
  waMessageId: string; fromNumber: string; type: MessageType
  classification: MessageClassification; textContent: string | null
  caption: string | null; waMediaId: string | null; mimeType: string | null
  receivedAt: Date
}
interface ResolvedBroker { id: string; status: BrokerStatus; plan: Plan; welcomed: boolean; trialUsed: boolean }

// ── Conversation (copy of _shared/conversation.ts) ────────────────────────────

type Plan = 'trial' | 'paid'
type SessionState = 'none' | 'collecting' | 'processing'
type ReplyKind = 'welcome' | 'start_hint' | 'paid_hint' | 'keep_going' | 'building' | 'trial_over'
interface BrokerState { plan: Plan; welcomed: boolean; trialUsed: boolean }
interface Decision { store: boolean; finalize: boolean; reply: ReplyKind | null }

const REPLY_DELAY_MS = 3000
const nothing: Decision = { store: false, finalize: false, reply: null }

function decide(broker: BrokerState, kind: MessageClassification, session: SessionState): Decision {
  if (broker.plan === 'paid') {
    if (kind === 'GREETING') return { ...nothing, reply: session === 'collecting' ? 'keep_going' : 'paid_hint' }
    if (kind === 'PROPERTY_INFO') return { ...nothing, store: true }
    if (kind === 'DONE' && session === 'collecting') return { ...nothing, store: true, finalize: true }
    return nothing
  }
  if (broker.trialUsed) return { ...nothing, reply: 'trial_over' }
  if (session === 'processing') return nothing
  if (!broker.welcomed) return { ...nothing, reply: 'welcome' }
  if (session === 'collecting') {
    if (kind === 'GREETING') return { ...nothing, reply: 'keep_going' }
    if (kind === 'PROPERTY_INFO') return { ...nothing, store: true }
    if (kind === 'DONE') return { store: true, finalize: true, reply: 'building' }
    return nothing
  }
  if (kind === 'PROPERTY_INFO') return { ...nothing, store: true }
  if (kind === 'GREETING' || kind === 'DONE') return { ...nothing, reply: 'start_hint' }
  return nothing
}

function displayHost(appUrl: string): string {
  return appUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

function replyText(kind: ReplyKind, appUrl: string): string {
  const site = displayHost(appUrl)
  switch (kind) {
    case 'welcome':
      return [
        'Hi 👋 Welcome to *FindHouse*!',
        '',
        'We turn your WhatsApp messages into a beautiful website for each property, ready to share with your clients.',
        '',
        '*How it works*',
        '1. Send photos, videos and details of a property here',
        '2. Send *done* when you’ve sent everything',
        '3. Get your property’s website link in about 30 seconds',
        '',
        `*Your dashboard*\nSign in at ${site} with this number to edit details and photos, track how your properties perform, and get your own page with all your listings.`,
        '',
        '*Let’s try one listing for you* 🏠',
        'Send the photos and details of *one property*: rent or price, location, rooms, size and anything else a client should know.',
        'When everything is sent, send *done* and we’ll build it for you.',
      ].join('\n')
    case 'start_hint':
      return 'Send the photos and details of *one property* here. When everything is sent, send *done* and we’ll build its website in about 30 seconds.'
    case 'paid_hint':
      return 'Hi 👋 Send the photos and details of a property here, then send *done* and we’ll build its website.'
    case 'keep_going':
      return 'Got it 👍 Keep sending photos and details. When everything is sent, send *done*.'
    case 'building':
      return 'Great! 🙌 Let’s build your website. I’ll be back in a few seconds with your link.'
    case 'trial_over':
      return [
        'Your free trial is over. We hope you liked your property website! 🏠',
        '',
        'To keep listing properties with FindHouse, choose a plan:',
        '• *Monthly:* ₹499 a month',
        '• *Yearly:* ₹4,999 a year (2 months free)',
      ].join('\n')
  }
}

// ── Message classifier ────────────────────────────────────────────────────────

const GREETING_PATTERNS = [
  /^(hi+|hey+|hello+|helo+|hii+|helo)[\s!.,]*$/i,
  /^good\s+(morning|afternoon|evening|day|night)[\s!.,]*$/i,
  /^(namaste|namaskar|salaam|salam|assalam|assalamualaikum)[\s!.,]*$/i,
  /^(howdy|greetings|sup|yo)[\s!.,]*$/i,
  /^(ok|okay|k|fine|sure|noted|thanks|thank you|thx|ty)[\s!.,]*$/i,
]

function classifyMessage(message: WAMessage): MessageClassification {
  if (message.type !== 'text') return 'PROPERTY_INFO'
  const trimmed = (message.text?.body ?? '').trim()
  if (!trimmed) return 'OTHER'
  if (/^done[.!,\s]*$/i.test(trimmed)) return 'DONE'
  for (const p of GREETING_PATTERNS) if (p.test(trimmed)) return 'GREETING'
  return 'PROPERTY_INFO'
}

/**
 * A location pin as text with a Google Maps link, so the extractor reads it and process-submission
 * saves the link on the property, where the public page shows it as a map.
 */
function locationText(loc: WALocation): string {
  const place = [loc.name, loc.address].filter(Boolean).join(', ')
  return `Location: https://www.google.com/maps?q=${loc.latitude},${loc.longitude}${place ? ` (${place})` : ''}`
}

// ── WhatsApp client ───────────────────────────────────────────────────────────

const WA_API_BASE = 'https://graph.facebook.com/v19.0'

async function downloadWAMedia(mediaId: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  if (!accessToken) throw new Error('WHATSAPP_ACCESS_TOKEN is not set')
  const metaRes = await fetch(`${WA_API_BASE}/${mediaId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!metaRes.ok) throw new Error(`Failed to fetch media metadata: ${metaRes.status}`)
  const meta = await metaRes.json() as { url: string; mime_type: string }
  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!fileRes.ok) throw new Error(`Failed to download media file: ${fileRes.status}`)
  return { bytes: new Uint8Array(await fileRes.arrayBuffer()), mimeType: meta.mime_type }
}

async function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')
  if (!appSecret) return true  // skip verification if secret not configured
  if (!signatureHeader?.startsWith('sha256=')) return false
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return signatureHeader === `sha256=${hex}`
}

async function sendWAMessage(toNumber: string, text: string): Promise<void> {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  if (!accessToken || !phoneNumberId) throw new Error('WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not set')
  const res = await fetch(`${WA_API_BASE}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: toNumber, type: 'text', text: { body: text } }),
  })
  if (!res.ok) throw new Error(`Failed to send WhatsApp message: ${res.status} — ${await res.text()}`)
}

function mimeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/webp': 'webp', 'video/mp4': 'mp4', 'video/3gpp': '3gp', 'video/quicktime': 'mov',
  }
  return map[mimeType] ?? 'bin'
}

// ── R2 client (inlined — bundles cannot import from _shared/) ─────────────────

const _r2encoder = new TextEncoder()

function _r2Config() {
  return {
    accountId: Deno.env.get('R2_ACCOUNT_ID')!,
    accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
    secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
    bucket: Deno.env.get('R2_BUCKET_NAME') ?? 'findhouse-media',
    publicUrl: Deno.env.get('R2_PUBLIC_URL')!,
  }
}

async function _hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, _r2encoder.encode(data))
}

async function _sha256(data: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function _toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function _signR2Request(
  method: string, url: string, headers: Record<string, string>,
  body: Uint8Array, accessKeyId: string, secretAccessKey: string,
): Promise<Record<string, string>> {
  const pu = new URL(url)
  const now = new Date()
  const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8)
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const region = 'auto', service = 's3'
  const payloadHash = await _sha256(body)
  const sh: Record<string, string> = { ...headers, host: pu.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate }
  const hkeys = Object.keys(sh).sort()
  const canonicalRequest = [method, pu.pathname, pu.search.replace('?', ''), hkeys.map((k) => `${k}:${sh[k]}\n`).join(''), hkeys.join(';'), payloadHash].join('\n')
  const credScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credScope, await _sha256(_r2encoder.encode(canonicalRequest))].join('\n')
  let sigKey = await _hmacSha256(_r2encoder.encode('AWS4' + secretAccessKey), dateStamp)
  sigKey = await _hmacSha256(sigKey, region)
  sigKey = await _hmacSha256(sigKey, service)
  sigKey = await _hmacSha256(sigKey, 'aws4_request')
  const sig = _toHex(await _hmacSha256(sigKey, stringToSign))
  return { ...sh, authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credScope}, SignedHeaders=${hkeys.join(';')}, Signature=${sig}` }
}

async function uploadToR2(key: string, body: Uint8Array, contentType: string): Promise<{ success: boolean; error?: string }> {
  const c = _r2Config()
  const endpoint = `https://${c.accountId}.r2.cloudflarestorage.com/${c.bucket}/${key}`
  const headers = await _signR2Request('PUT', endpoint, { 'content-type': contentType }, body, c.accessKeyId, c.secretAccessKey)
  const res = await fetch(endpoint, { method: 'PUT', headers, body })
  if (!res.ok) { const text = await res.text(); return { success: false, error: `R2 upload failed (${res.status}): ${text}` } }
  return { success: true }
}

// ── Broker manager ────────────────────────────────────────────────────────────

async function resolveBroker(db: SupabaseClient, phone: string): Promise<ResolvedBroker | null> {
  const { error: upsertError } = await db
    .from('brokers')
    .upsert({ phone, status: 'ACTIVE' }, { onConflict: 'phone', ignoreDuplicates: true })
  if (upsertError) throw new Error(`[brokerManager] Upsert failed for ${phone}: ${upsertError.message}`)
  const { data, error: selectError } = await db.from('brokers').select('id, status, plan, welcomed_at, trial_used_at').eq('phone', phone).single()
  if (selectError || !data) { console.error(`[brokerManager] Could not read broker for ${phone}:`, selectError?.message); return null }
  return {
    id: data.id as string,
    status: data.status as BrokerStatus,
    plan: data.plan === 'trial' ? 'trial' : 'paid',
    welcomed: data.welcomed_at != null,
    trialUsed: data.trial_used_at != null,
  }
}

async function noteInboundMessage(db: SupabaseClient, brokerId: string, waMessageId: string): Promise<void> {
  const { error } = await db.from('brokers').update({ last_inbound_message_id: waMessageId }).eq('id', brokerId)
  if (error) console.error(`[brokerManager] Could not note message ${waMessageId}:`, error.message)
}

/** See claim_auto_reply in migration 013. */
async function claimAutoReply(db: SupabaseClient, brokerId: string, waMessageId: string, kind: ReplyKind): Promise<boolean> {
  const { data, error } = await db.rpc('claim_auto_reply', { claim_broker_id: brokerId, message_id: waMessageId, reply_kind: kind })
  if (error) { console.error(`[brokerManager] claim_auto_reply failed for ${waMessageId}:`, error.message); return false }
  return data === true
}

// ── Session manager ───────────────────────────────────────────────────────────

async function getActiveSession(db: SupabaseClient, brokerId: string): Promise<{ id: string } | null> {
  const { data } = await db.from('whatsapp_submissions').select('id').eq('broker_id', brokerId).eq('status', 'COLLECTING').maybeSingle()
  return data ?? null
}

async function createSession(db: SupabaseClient, brokerId: string, senderPhone: string): Promise<string> {
  const { data, error } = await db.from('whatsapp_submissions').insert({ broker_id: brokerId, sender_phone: senderPhone, status: 'COLLECTING' }).select('id').single()
  if (error) {
    if (error.message.includes('one_active_submission_per_sender') || error.code === '23505') {
      const existing = await getActiveSession(db, brokerId)
      if (existing) return existing.id
    }
    throw new Error(`Failed to create submission: ${error.message}`)
  }
  return data.id
}

async function addMessageToSession(db: SupabaseClient, sessionId: string, _brokerId: string, msg: ParsedMessage, storagePath: string | null): Promise<void> {
  const { error } = await db.from('whatsapp_submission_messages').insert({
    submission_id: sessionId, whatsapp_message_id: msg.waMessageId, message_type: msg.type,
    text_body: msg.textContent, media_id: msg.waMediaId, media_type: msg.waMediaId ? msg.type : null,
    mime_type: msg.mimeType, media_storage_path: storagePath, caption: msg.caption,
    whatsapp_timestamp: msg.receivedAt.toISOString(),
  })
  if (error && !error.message.includes('duplicate') && !error.code?.includes('23505')) {
    throw new Error(`Failed to store message: ${error.message}`)
  }
}

async function finalizeSession(db: SupabaseClient, sessionId: string): Promise<void> {
  const { error } = await db.from('whatsapp_submissions').update({ status: 'PROCESSING', updated_at: new Date().toISOString() }).eq('id', sessionId).eq('status', 'COLLECTING')
  if (error) throw new Error(`Failed to finalize submission: ${error.message}`)
}

/** A build stuck longer than this no longer counts as in progress. */
const PROCESSING_STALE_MS = 10 * 60 * 1000

async function hasProcessingSession(db: SupabaseClient, brokerId: string): Promise<boolean> {
  const { data } = await db.from('whatsapp_submissions').select('id').eq('broker_id', brokerId).eq('status', 'PROCESSING')
    .gte('updated_at', new Date(Date.now() - PROCESSING_STALE_MS).toISOString()).limit(1)
  return (data?.length ?? 0) > 0
}

async function isDuplicate(db: SupabaseClient, waMessageId: string): Promise<boolean> {
  const { data } = await db.from('whatsapp_submission_messages').select('id').eq('whatsapp_message_id', waMessageId).maybeSingle()
  return data !== null
}

// ── Main ──────────────────────────────────────────────────────────────────────

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const APP_URL = Deno.env.get('APP_URL') ?? 'https://findhouse.in'

/** Keeps the function alive for work that outlasts the response (the delayed replies). */
function runInBackground(task: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
  runtime?.waitUntil(task)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && token === Deno.env.get('WHATSAPP_VERIFY_TOKEN')) {
      console.log('[webhook] Verification handshake accepted')
      return new Response(challenge ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')
  const valid = await verifyWebhookSignature(rawBody, signature)
  if (!valid) { console.warn('[webhook] Invalid signature — rejecting request'); return new Response('Unauthorized', { status: 401 }) }

  runInBackground(processWebhook(rawBody).catch((err) => console.error('[webhook] Background processing error:', err)))
  return new Response('OK', { status: 200 })
})

async function processWebhook(rawBody: string) {
  let payload: WAWebhookPayload
  try { payload = JSON.parse(rawBody) } catch { console.error('[webhook] Failed to parse payload'); return }
  if (payload.object !== 'whatsapp_business_account') return
  const replies: Promise<void>[] = []
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      for (const msg of change.value.messages ?? []) {
        await handleMessage(msg, replies).catch((err) =>
          console.error(`[webhook] Error handling message ${msg.id}:`, err))
      }
    }
  }
  await Promise.all(replies)
}

/**
 * Waits a moment, then answers the message unless the broker sent another one meanwhile (that one gets the reply)
 * or the reply's limit is reached.
 */
async function replyLater(brokerId: string, to: string, waMessageId: string, kind: ReplyKind): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, REPLY_DELAY_MS))
  if (!(await claimAutoReply(db, brokerId, waMessageId, kind))) return
  await sendWAMessage(to, replyText(kind, APP_URL))
    .catch((err) => console.error(`[webhook] Failed to send ${kind} reply to ${to}:`, err))
}

/** A delayed reply, if the message gets one, is added to `replies` for the caller to wait on. */
async function handleMessage(msg: WAMessage, replies: Promise<void>[]) {
  const fromNumber = msg.from
  console.log(`[webhook] Message from ${fromNumber} — type: ${msg.type}, id: ${msg.id}`)

  const broker = await resolveBroker(db, fromNumber)
  if (!broker) { console.error(`[webhook] Could not resolve broker for ${fromNumber}`); return }
  if (broker.status !== 'ACTIVE') { console.log(`[webhook] Broker ${fromNumber} is ${broker.status} — message rejected`); return }
  const brokerId: string = broker.id

  if (await isDuplicate(db, msg.id)) { console.log(`[webhook] Duplicate message skipped: ${msg.id}`); return }

  const classification = classifyMessage(msg)
  console.log(`[webhook] Classification: ${classification}`)

  await noteInboundMessage(db, brokerId, msg.id)
  const active = await getActiveSession(db, brokerId)
  const session: SessionState = active
    ? 'collecting'
    : broker.plan === 'trial' && await hasProcessingSession(db, brokerId) ? 'processing' : 'none'
  const decision = decide(broker, classification, session)
  console.log(`[webhook] ${broker.plan} broker, session ${session}:`, decision)

  if (decision.reply && decision.reply !== 'building') {
    replies.push(replyLater(brokerId, fromNumber, msg.id, decision.reply))
  }
  if (!decision.store) return

  let sessionId: string
  if (active) { sessionId = active.id } else { sessionId = await createSession(db, brokerId, fromNumber); console.log(`[webhook] New session created: ${sessionId}`) }

  let storagePath: string | null = null
  const waMediaId = msg.image?.id ?? msg.video?.id ?? msg.document?.id ?? msg.audio?.id ?? null
  if (waMediaId) {
    try {
      const { bytes, mimeType } = await downloadWAMedia(waMediaId)
      const ext = mimeToExtension(mimeType)
      const path = `submissions/${sessionId}/${msg.id}.${ext}`
      const result = await uploadToR2(path, bytes, mimeType)
      if (!result.success) { console.warn(`[webhook] Media upload failed: ${result.error}`) } else { storagePath = path }
    } catch (err) { console.warn(`[webhook] Media download failed: ${err}`) }
  }

  const parsed: ParsedMessage = {
    waMessageId: msg.id, fromNumber, type: msg.location ? 'text' : msg.type, classification,
    textContent: msg.location ? locationText(msg.location) : msg.text?.body ?? null, caption: msg.image?.caption ?? null,
    waMediaId, mimeType: msg.image?.mime_type ?? msg.video?.mime_type ?? msg.document?.mime_type ?? msg.audio?.mime_type ?? null,
    receivedAt: new Date(parseInt(msg.timestamp) * 1000),
  }

  await addMessageToSession(db, sessionId, brokerId, parsed, storagePath)
  console.log(`[webhook] Message ${msg.id} stored in session ${sessionId}`)

  if (decision.finalize) {
    await finalizeSession(db, sessionId)
    console.log(`[webhook] Session ${sessionId} finalized — triggering processing`)
    if (decision.reply === 'building') {
      await sendWAMessage(fromNumber, replyText('building', APP_URL))
        .catch((err) => console.error(`[webhook] Failed to send building reply to ${fromNumber}:`, err))
    }
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ sessionId }),
    }).catch((err) => console.error('[webhook] Failed to invoke process-submission:', err))
  }
}
