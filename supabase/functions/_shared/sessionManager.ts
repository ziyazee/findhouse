import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ParsedMessage } from './types.ts'

// ── Session queries ───────────────────────────────────────────────────────────

/** Returns the broker's current COLLECTING submission, or null if none exists. */
export async function getActiveSession(
  db: SupabaseClient,
  brokerId: string,
): Promise<{ id: string } | null> {
  const { data } = await db
    .from('whatsapp_submissions')
    .select('id')
    .eq('broker_id', brokerId)
    .eq('status', 'COLLECTING')
    .maybeSingle()

  return data ?? null
}

/** Creates a new COLLECTING submission for this broker. */
export async function createSession(
  db: SupabaseClient,
  brokerId: string,
  senderPhone: string,
): Promise<string> {
  const { data, error } = await db
    .from('whatsapp_submissions')
    .insert({ broker_id: brokerId, sender_phone: senderPhone, status: 'COLLECTING' })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create submission: ${error.message}`)
  return data.id
}

/**
 * Stores one message in whatsapp_submission_messages.
 * The unique constraint on whatsapp_message_id makes this idempotent —
 * duplicate webhook events are silently dropped.
 */
export async function addMessageToSession(
  db: SupabaseClient,
  sessionId: string,
  _brokerId: string,   // kept in signature for call-site compatibility; not stored in messages
  msg: ParsedMessage,
  storagePath: string | null,
): Promise<void> {
  const { error } = await db.from('whatsapp_submission_messages').insert({
    submission_id:       sessionId,
    whatsapp_message_id: msg.waMessageId,
    message_type:        msg.type,
    text_body:           msg.textContent,
    media_id:            msg.waMediaId,
    media_type:          msg.waMediaId ? msg.type : null,
    mime_type:           msg.mimeType,
    media_storage_path:  storagePath,
    caption:             msg.caption,
    whatsapp_timestamp:  msg.receivedAt.toISOString(),
  })

  // Unique constraint on whatsapp_message_id — duplicate webhooks are silently dropped
  if (error && !error.message.includes('duplicate') && !error.code?.includes('23505')) {
    throw new Error(`Failed to store message: ${error.message}`)
  }
}

/**
 * Transitions a submission from COLLECTING → PROCESSING when DONE is received.
 * False when it was no longer COLLECTING (another "done", or a repeat delivery, got there first).
 */
export async function finalizeSession(
  db: SupabaseClient,
  sessionId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from('whatsapp_submissions')
    .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('status', 'COLLECTING')   // guard: only advance if still COLLECTING
    .select('id')

  if (error) throw new Error(`Failed to finalize submission: ${error.message}`)
  return (data?.length ?? 0) > 0
}

/** "done" waits until the open submission has had no new message for this long… */
const SETTLE_QUIET_MS = 3000
/** …or this long at most. */
const SETTLE_MAX_MS = 20000

/**
 * Each WhatsApp message arrives as its own webhook call and photos take longer to save, so "done" can arrive
 * before the messages sent just before it are stored (or before their submission exists). Waits until the broker's
 * open submission has stopped growing and returns it, or null if none was opened.
 */
export async function waitForSettledSession(db: SupabaseClient, brokerId: string): Promise<string | null> {
  const started = Date.now()
  let snapshot = ''
  let quietSince = started
  while (Date.now() - started < SETTLE_MAX_MS) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const active = await getActiveSession(db, brokerId)
    const { count } = active
      ? await db.from('whatsapp_submission_messages').select('id', { count: 'exact', head: true }).eq('submission_id', active.id)
      : { count: 0 }
    const now = active ? `${active.id}:${count ?? 0}` : ''
    if (now !== snapshot) {
      snapshot = now
      quietSince = Date.now()
    } else if (active && Date.now() - quietSince >= SETTLE_QUIET_MS) {
      return active.id
    }
  }
  return (await getActiveSession(db, brokerId))?.id ?? null
}

/** A build stuck longer than this no longer counts as in progress. */
const PROCESSING_STALE_MS = 10 * 60 * 1000

/** Whether one of the broker's submissions is being built right now. */
export async function hasProcessingSession(db: SupabaseClient, brokerId: string): Promise<boolean> {
  const { data } = await db
    .from('whatsapp_submissions')
    .select('id')
    .eq('broker_id', brokerId)
    .eq('status', 'PROCESSING')
    .gte('updated_at', new Date(Date.now() - PROCESSING_STALE_MS).toISOString())
    .limit(1)

  return (data?.length ?? 0) > 0
}

/** Marks a submission COMPLETED and links the generated property. */
export async function completeSession(
  db: SupabaseClient,
  sessionId: string,
  propertyId: string,
): Promise<void> {
  const { error } = await db
    .from('whatsapp_submissions')
    .update({
      status:       'COMPLETED',
      property_id:  propertyId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) throw new Error(`Failed to complete submission: ${error.message}`)
}

/** Marks a submission FAILED with a reason. Preserves all messages for retry. */
export async function failSession(
  db: SupabaseClient,
  sessionId: string,
  reason: string,
): Promise<void> {
  const { error } = await db
    .from('whatsapp_submissions')
    .update({ status: 'FAILED', failure_reason: reason })
    .eq('id', sessionId)

  if (error) console.error(`[sessionManager] Failed to mark submission failed: ${error.message}`)
}

/**
 * Fetches all messages for a submission, ordered by whatsapp_timestamp.
 * Returns a shape compatible with aiExtractor (content / storage_path aliases).
 */
export async function getSessionMessages(
  db: SupabaseClient,
  sessionId: string,
): Promise<Array<{
  message_type: string
  content: string | null
  storage_path: string | null
  received_at: string
}>> {
  const { data, error } = await db
    .from('whatsapp_submission_messages')
    .select('message_type, text_body, media_storage_path, whatsapp_timestamp')
    .eq('submission_id', sessionId)
    .order('whatsapp_timestamp', { ascending: true, nullsFirst: false })

  if (error) throw new Error(`Failed to fetch messages: ${error.message}`)

  // Alias new column names to the shape aiExtractor expects
  return (data ?? []).map((row) => ({
    message_type: row.message_type,
    content:      row.text_body,
    storage_path: row.media_storage_path,
    received_at:  row.whatsapp_timestamp ?? new Date().toISOString(),
  }))
}

/** Checks whether a whatsapp_message_id has already been processed (deduplication). */
export async function isDuplicate(db: SupabaseClient, waMessageId: string): Promise<boolean> {
  const { data } = await db
    .from('whatsapp_submission_messages')
    .select('id')
    .eq('whatsapp_message_id', waMessageId)
    .maybeSingle()

  return data !== null
}
