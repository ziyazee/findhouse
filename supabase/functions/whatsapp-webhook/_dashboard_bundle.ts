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
  statuses?: WAStatus[]
}
/** What happened to a message we sent: sent, delivered, read or failed (with the reason). */
interface WAStatus {
  id: string; status: string; recipient_id: string
  errors?: Array<{ code: number; title: string; message?: string; error_data?: { details?: string } }>
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
interface ResolvedBroker { id: string; status: BrokerStatus; plan: Plan; trialUsed: boolean }

// ── Conversation (copy of decide in _shared/conversation.ts) ──────────────────

type Plan = 'trial' | 'paid'
type SessionState = 'none' | 'collecting' | 'processing'
interface BrokerState { plan: Plan; trialUsed: boolean }
/** finalize: start building now. Messages that arrive while it is built are added to it. */
interface Decision { store: boolean; finalize: boolean }

const ignore: Decision = { store: false, finalize: false }

function decide(broker: BrokerState, kind: MessageClassification, session: SessionState): Decision {
  // The listing being built takes every detail until its reply goes out; another "done" changes nothing.
  if (session === 'processing') return kind === 'PROPERTY_INFO' ? { store: true, finalize: false } : ignore
  // Trial: once the free listing has been sent, everything is ignored.
  if (broker.plan === 'trial' && broker.trialUsed) return ignore
  if (kind === 'PROPERTY_INFO') return { store: true, finalize: false }
  if (kind === 'DONE') return { store: true, finalize: true }
  return ignore
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

/** Invite-only: finds the broker FindHouse added in the admin page. A number nobody added is null and is ignored. */
async function resolveBroker(db: SupabaseClient, phone: string): Promise<ResolvedBroker | null> {
  const { data, error: selectError } = await db.from('brokers').select('id, status, plan, trial_used_at').eq('phone', phone).maybeSingle()
  if (selectError) throw new Error(`[brokerManager] Could not read broker for ${phone}: ${selectError.message}`)
  if (!data) return null
  return {
    id: data.id as string,
    status: data.status as BrokerStatus,
    plan: data.plan === 'trial' ? 'trial' : 'paid',
    trialUsed: data.trial_used_at != null,
  }
}

// ── Session manager ───────────────────────────────────────────────────────────

// Open while COLLECTING (before "done") and PROCESSING (being built, until the reply goes out). Recording and closing
// are database functions (migration 022) sharing a per-broker lock, so no message falls between two submissions.
type OpenSubmission = { id: string; status: 'COLLECTING' | 'PROCESSING' }

/** Keep in step with the 10 minutes in record_submission_message: a build stuck this long no longer holds messages. */
const PROCESSING_STALE_MS = 10 * 60 * 1000

async function getOpenSession(db: SupabaseClient, brokerId: string): Promise<OpenSubmission | null> {
  const { data, error } = await db.from('whatsapp_submissions').select('id, status, updated_at').eq('broker_id', brokerId)
    .in('status', ['COLLECTING', 'PROCESSING']).order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to read submissions: ${error.message}`)
  const fresh = Date.now() - PROCESSING_STALE_MS
  const open = (data ?? []).find((s) => s.status === 'COLLECTING' || Date.parse(s.updated_at) > fresh)
  return open ? { id: open.id, status: open.status } : null
}

/** Records a message in the open submission (opening one if `mayOpen`); media starts pending. Null when not recorded. */
async function recordMessage(db: SupabaseClient, brokerId: string, senderPhone: string, mayOpen: boolean, msg: ParsedMessage): Promise<OpenSubmission | null> {
  const { data, error } = await db.rpc('record_submission_message', {
    p_broker_id: brokerId, p_sender_phone: senderPhone, p_may_open: mayOpen,
    p_message: {
      whatsapp_message_id: msg.waMessageId, message_type: msg.type, text_body: msg.textContent, caption: msg.caption,
      media_id: msg.waMediaId, media_type: msg.waMediaId ? msg.type : null, mime_type: msg.mimeType,
      media_status: msg.waMediaId ? 'pending' : 'none', whatsapp_timestamp: msg.receivedAt.toISOString(),
    },
  })
  if (error) throw new Error(`Failed to record message: ${error.message}`)
  const row = (data as Array<{ submission_id: string; submission_status: OpenSubmission['status'] }> | null)?.[0]
  return row ? { id: row.submission_id, status: row.submission_status } : null
}

async function setMediaResult(db: SupabaseClient, waMessageId: string, storagePath: string | null): Promise<void> {
  const { error } = await db.from('whatsapp_submission_messages')
    .update({ media_storage_path: storagePath, media_status: storagePath ? 'ready' : 'failed' }).eq('whatsapp_message_id', waMessageId)
  if (error) throw new Error(`Failed to save media result: ${error.message}`)
}

/** False when it was no longer COLLECTING (another "done", or a repeat delivery, got there first). */
async function finalizeSession(db: SupabaseClient, sessionId: string): Promise<boolean> {
  const { data, error } = await db.from('whatsapp_submissions').update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
    .eq('id', sessionId).eq('status', 'COLLECTING').select('id')
  if (error) throw new Error(`Failed to finalize submission: ${error.message}`)
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

/** Keeps the function alive for work that outlasts the response (media downloads and uploads). */
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
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      for (const s of change.value.statuses ?? []) logDeliveryStatus(s)
      for (const msg of change.value.messages ?? []) {
        await handleMessage(msg).catch((err) =>
          console.error(`[webhook] Error handling message ${msg.id}:`, err))
      }
    }
  }
}

function logDeliveryStatus(s: WAStatus) {
  const why = (s.errors ?? []).map((e) => `${e.code} ${e.title}${e.error_data?.details ? ` — ${e.error_data.details}` : ''}`).join('; ')
  const line = `[webhook] Reply ${s.id} to ${s.recipient_id}: ${s.status}${why ? ` (${why})` : ''}`
  if (s.status === 'failed') console.error(line)
  else console.log(line)
}

async function handleMessage(msg: WAMessage) {
  const fromNumber = msg.from
  console.log(`[webhook] Message from ${fromNumber} — type: ${msg.type}, id: ${msg.id}`)

  const broker = await resolveBroker(db, fromNumber)
  if (!broker) { console.log(`[webhook] ${fromNumber} is not a registered broker — message ignored`); return }
  if (broker.status !== 'ACTIVE') { console.log(`[webhook] Broker ${fromNumber} is ${broker.status} — message rejected`); return }
  const brokerId: string = broker.id

  if (await isDuplicate(db, msg.id)) { console.log(`[webhook] Duplicate message skipped: ${msg.id}`); return }

  const classification = classifyMessage(msg)
  console.log(`[webhook] Classification: ${classification}`)

  const open = await getOpenSession(db, brokerId)
  const session: SessionState = !open ? 'none' : open.status === 'PROCESSING' ? 'processing' : 'collecting'
  const state = { plan: broker.plan, trialUsed: broker.trialUsed }
  const decision = decide(state, classification, session)
  console.log(`[webhook] ${broker.plan} broker, session ${session}:`, decision)
  if (!decision.store) return

  // Recorded at once, before fetching any photo, so a build in progress knows it is coming.
  const waMediaId = msg.image?.id ?? msg.video?.id ?? msg.document?.id ?? msg.audio?.id ?? null
  const parsed: ParsedMessage = {
    waMessageId: msg.id, fromNumber, type: msg.location ? 'text' : msg.type, classification,
    textContent: msg.location ? locationText(msg.location) : msg.text?.body ?? null, caption: msg.image?.caption ?? null,
    waMediaId, mimeType: msg.image?.mime_type ?? msg.video?.mime_type ?? msg.document?.mime_type ?? msg.audio?.mime_type ?? null,
    receivedAt: new Date(parseInt(msg.timestamp) * 1000),
  }
  // The submission can close between the lookup above and now; the message then opens the next one, if it may.
  const recorded = await recordMessage(db, brokerId, fromNumber, decide(state, classification, 'none').store, parsed)
  if (!recorded) { console.log(`[webhook] Message ${msg.id} not recorded (already recorded, or nothing open to add it to)`); return }
  console.log(`[webhook] Message ${msg.id} recorded in ${recorded.status} submission ${recorded.id}`)

  if (waMediaId) await storeMedia(msg.id, recorded.id, waMediaId)

  // "done": build now. The submission keeps taking messages until the reply goes out.
  if (decision.finalize && recorded.status === 'COLLECTING') await buildListing(recorded.id)
}

/** Copies a photo or video from WhatsApp to storage, trying twice. Its message is marked ready or failed either way. */
async function storeMedia(waMessageId: string, sessionId: string, waMediaId: string) {
  let storagePath: string | null = null
  for (let attempt = 1; attempt <= 2 && !storagePath; attempt++) {
    try {
      const { bytes, mimeType } = await downloadWAMedia(waMediaId)
      const path = `submissions/${sessionId}/${waMessageId}.${mimeToExtension(mimeType)}`
      const result = await uploadToR2(path, bytes, mimeType)
      if (result.success) storagePath = path
      else console.warn(`[webhook] Media upload failed (attempt ${attempt}): ${result.error}`)
    } catch (err) { console.warn(`[webhook] Media download failed (attempt ${attempt}): ${err}`) }
  }
  await setMediaResult(db, waMessageId, storagePath)
  console.log(`[webhook] Media for ${waMessageId} ${storagePath ? `stored at ${storagePath}` : 'failed'}`)
}

/** Moves the submission to PROCESSING and starts process-submission, which builds the listing and replies. */
async function buildListing(sessionId: string) {
  if (!(await finalizeSession(db, sessionId))) {
    console.log(`[webhook] Session ${sessionId} was already finalized — not building it twice`)
    return
  }
  console.log(`[webhook] Session ${sessionId} finalized — triggering processing`)
  // Awaited so the function isn't shut down before the request goes out. process-submission answers at once.
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-submission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
    body: JSON.stringify({ sessionId }),
  }).catch((err) => { console.error('[webhook] Failed to invoke process-submission:', err); return null })
  if (res) console.log(`[webhook] process-submission answered ${res.status} for session ${sessionId}`)
}
