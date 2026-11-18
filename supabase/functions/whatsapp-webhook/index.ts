import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { classifyMessage } from '../_shared/messageClassifier.ts'
import {
  getActiveSession,
  createSession,
  addMessageToSession,
  finalizeSession,
  isDuplicate,
} from '../_shared/sessionManager.ts'
import {
  verifyWebhookSignature,
  downloadWAMedia,
  mimeToExtension,
} from '../_shared/whatsappClient.ts'
import { resolveBroker } from '../_shared/brokerManager.ts'
import type { WAWebhookPayload, WAMessage, ParsedMessage } from '../_shared/types.ts'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

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
  processWebhook(rawBody).catch((err) =>
    console.error('[webhook] Background processing error:', err),
  )

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
      for (const msg of change.value.messages ?? []) {
        await handleMessage(msg, change.value.metadata.phone_number_id).catch((err) =>
          console.error(`[webhook] Error handling message ${msg.id}:`, err),
        )
      }
    }
  }
}

async function handleMessage(msg: WAMessage, _phoneNumberId: string) {
  const fromNumber = msg.from  // E.164 format

  console.log(`[webhook] Message from ${fromNumber} — type: ${msg.type}, id: ${msg.id}`)

  // ── 1. Resolve broker (upsert on first contact) ───────────────────────────
  const broker = await resolveBroker(db, fromNumber)

  if (!broker) {
    console.error(`[webhook] Could not resolve broker for ${fromNumber}`)
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

  if (classification === 'GREETING' || classification === 'OTHER') return

  // ── 4. Session routing ────────────────────────────────────────────────────
  let sessionId: string | null = null

  if (classification === 'DONE') {
    const active = await getActiveSession(db, brokerId)
    if (!active) {
      console.log(`[webhook] DONE received with no active session for broker ${brokerId}`)
      return
    }
    sessionId = active.id
  } else {
    // PROPERTY_INFO — get or create session
    const active = await getActiveSession(db, brokerId)
    if (active) {
      sessionId = active.id
    } else {
      sessionId = await createSession(db, brokerId, fromNumber)
      console.log(`[webhook] New session created: ${sessionId}`)
    }
  }

  // ── 5. Download media if applicable ──────────────────────────────────────
  let storagePath: string | null = null
  const waMediaId = getMediaId(msg)

  if (waMediaId) {
    try {
      const { bytes, mimeType } = await downloadWAMedia(waMediaId)
      const ext = mimeToExtension(mimeType)
      const path = `submissions/${sessionId}/${msg.id}.${ext}`

      const { error: uploadError } = await db.storage
        .from('property-media')
        .upload(path, bytes, { contentType: mimeType, upsert: false, cacheControl: '31536000' })

      if (uploadError) {
        console.warn(`[webhook] Media upload failed: ${uploadError.message}`)
      } else {
        storagePath = path
      }
    } catch (err) {
      console.warn(`[webhook] Media download failed: ${err}`)
      // Continue without media — don't fail the whole message
    }
  }

  // ── 6. Store message ──────────────────────────────────────────────────────
  const parsed: ParsedMessage = {
    waMessageId: msg.id,
    fromNumber,
    type: msg.type,
    classification,
    textContent: msg.text?.body ?? null,
    caption:     msg.image?.caption ?? null,
    waMediaId,
    mimeType: getMediaMime(msg),
    receivedAt: new Date(parseInt(msg.timestamp) * 1000),
  }

  await addMessageToSession(db, sessionId, brokerId, parsed, storagePath)
  console.log(`[webhook] Message ${msg.id} stored in session ${sessionId}`)

  // ── 7. If DONE: finalize and trigger processing ───────────────────────────
  if (classification === 'DONE') {
    await finalizeSession(db, sessionId)
    console.log(`[webhook] Session ${sessionId} finalized — triggering processing`)

    // Invoke process-submission asynchronously (fire-and-forget from webhook perspective)
    const processUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-submission`
    fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ sessionId }),
    }).catch((err) => console.error('[webhook] Failed to invoke process-submission:', err))
  }
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
