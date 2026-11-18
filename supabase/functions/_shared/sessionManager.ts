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

/** Transitions a submission from COLLECTING → PROCESSING when DONE is received. */
export async function finalizeSession(
  db: SupabaseClient,
  sessionId: string,
): Promise<void> {
  const { error } = await db
    .from('whatsapp_submissions')
    .update({ status: 'PROCESSING' })
    .eq('id', sessionId)
    .eq('status', 'COLLECTING')   // guard: only advance if still COLLECTING

  if (error) throw new Error(`Failed to finalize submission: ${error.message}`)
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
