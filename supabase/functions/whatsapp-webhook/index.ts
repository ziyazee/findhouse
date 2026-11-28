import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { classifyMessage } from '../_shared/messageClassifier.ts'
import {
  getOpenSession,
  recordMessage,
  setMediaResult,
  finalizeSession,
  isDuplicate,
} from '../_shared/sessionManager.ts'
import {
  verifyWebhookSignature,
  downloadWAMedia,
  mimeToExtension,
} from '../_shared/whatsappClient.ts'
import { resolveBroker } from '../_shared/brokerManager.ts'
import { decide, type SessionState } from '../_shared/conversation.ts'
import { uploadToR2 } from '../_shared/r2Client.ts'
import type { WAWebhookPayload, WAMessage, WALocation, WAStatus, ParsedMessage } from '../_shared/types.ts'

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
  // ── GET: Meta webhook verification handshake ──────────────────────────────
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

  // ── POST: Incoming message ────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Always respond 200 to Meta immediately — process async
  const rawBody = await req.text()

  // Verify HMAC signature
  const signature = req.headers.get('x-hub-signature-256')
  const valid = await verifyWebhookSignature(rawBody, signature)
  if (!valid) {
    console.warn('[webhook] Invalid signature — rejecting request')
    return new Response('Unauthorized', { status: 401 })
  }

  // Process in background so Meta gets the 200 fast
  runInBackground(processWebhook(rawBody).catch((err) =>
    console.error('[webhook] Background processing error:', err),
  ))

  return new Response('OK', { status: 200 })
})

async function processWebhook(rawBody: string) {
  let payload: WAWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    console.error('[webhook] Failed to parse payload')
    return
  }

  if (payload.object !== 'whatsapp_business_account') return

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      for (const s of change.value.statuses ?? []) logDeliveryStatus(s)
      for (const msg of change.value.messages ?? []) {
        await handleMessage(msg).catch((err) =>
          console.error(`[webhook] Error handling message ${msg.id}:`, err),
        )
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
  const fromNumber = msg.from  // E.164 format

  console.log(`[webhook] Message from ${fromNumber} — type: ${msg.type}, id: ${msg.id}`)

  // ── 1. Resolve broker (invite-only: numbers added in the admin page) ──────
  const broker = await resolveBroker(db, fromNumber)

  if (!broker) {
    console.log(`[webhook] ${fromNumber} is not a registered broker — message ignored`)
    return
  }

  if (broker.status !== 'ACTIVE') {
    console.log(`[webhook] Broker ${fromNumber} is ${broker.status} — message rejected`)
    return
  }

  const brokerId: string = broker.id

  // ── 2. Deduplicate ────────────────────────────────────────────────────────
  if (await isDuplicate(db, msg.id)) {
    console.log(`[webhook] Duplicate message skipped: ${msg.id}`)
    return
  }

  // ── 3. Classify ──────────────────────────────────────────────────────────
  const classification = classifyMessage(msg)
  console.log(`[webhook] Classification: ${classification}`)

  // ── 4. Decide: keep it, build, or ignore (see _shared/conversation.ts) ───
  const open = await getOpenSession(db, brokerId)
  const session: SessionState = !open ? 'none' : open.status === 'PROCESSING' ? 'processing' : 'collecting'
  const state = { plan: broker.plan, trialUsed: broker.trialUsed }
  const decision = decide(state, classification, session)
  console.log(`[webhook] ${broker.plan} broker, session ${session}:`, decision)

  if (!decision.store) return

  // ── 5. Record it at once, before fetching any photo, so a build in progress knows it is coming ───────────────
  const waMediaId = getMediaId(msg)
  const parsed: ParsedMessage = {
    waMessageId: msg.id,
    fromNumber,
    type: msg.location ? 'text' : msg.type,
    classification,
    textContent: msg.location ? locationText(msg.location) : msg.text?.body ?? null,
    caption:     msg.image?.caption ?? null,
    waMediaId,
    mimeType: getMediaMime(msg),
    receivedAt: new Date(parseInt(msg.timestamp) * 1000),
  }

  // The submission can close between the lookup above and now; the message then opens the next one, if it may.
  const recorded = await recordMessage(db, brokerId, fromNumber, decide(state, classification, 'none').store, parsed)
  if (!recorded) {
    console.log(`[webhook] Message ${msg.id} not recorded (already recorded, or nothing open to add it to)`)
    return
  }
  console.log(`[webhook] Message ${msg.id} recorded in ${recorded.status} submission ${recorded.id}`)

  // ── 6. Fetch the photo or video ──────────────────────────────────────────
  if (waMediaId) await storeMedia(msg.id, recorded.id, waMediaId)

  // ── 7. "done": build now. The submission keeps taking messages until the reply goes out ─────────────────────
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
    } catch (err) {
      console.warn(`[webhook] Media download failed (attempt ${attempt}): ${err}`)
    }
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

  // Awaited so the function isn't shut down before the request goes out. process-submission answers at once and
  // builds in the background.
  const processUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-submission`
  const res = await fetch(processUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ sessionId }),
  }).catch((err) => { console.error('[webhook] Failed to invoke process-submission:', err); return null })
  if (res) console.log(`[webhook] process-submission answered ${res.status} for session ${sessionId}`)
}

/**
 * A location pin as text with a Google Maps link, so the extractor reads it and process-submission
 * saves the link on the property, where the public page shows it as a map.
 */
function locationText(loc: WALocation): string {
  const place = [loc.name, loc.address].filter(Boolean).join(', ')
  return `Location: https://www.google.com/maps?q=${loc.latitude},${loc.longitude}${place ? ` (${place})` : ''}`
}

function getMediaId(msg: WAMessage): string | null {
  return msg.image?.id ?? msg.video?.id ?? msg.document?.id ?? msg.audio?.id ?? null
}

function getMediaMime(msg: WAMessage): string | null {
  return (
    msg.image?.mime_type ??
    msg.video?.mime_type ??
    msg.document?.mime_type ??
    msg.audio?.mime_type ??
    null
  )
}
