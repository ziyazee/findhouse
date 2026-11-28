import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ParsedMessage } from './types.ts'

// A submission is open while COLLECTING (before "done") and while PROCESSING (the listing is being built, until the
// reply goes out). COMPLETED is closed. Recording and closing are database functions (migration 022) that take the
// same per-broker lock, so a message never falls between a closing submission and the next one.

export type OpenSubmission = { id: string; status: 'COLLECTING' | 'PROCESSING' }

/** Keep in step with the 10 minutes in record_submission_message: a build stuck this long no longer holds messages. */
const PROCESSING_STALE_MS = 10 * 60 * 1000

/** The broker's open submission, or null. */
export async function getOpenSession(db: SupabaseClient, brokerId: string): Promise<OpenSubmission | null> {
  const { data, error } = await db
    .from('whatsapp_submissions')
    .select('id, status, updated_at')
    .eq('broker_id', brokerId)
    .in('status', ['COLLECTING', 'PROCESSING'])
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to read submissions: ${error.message}`)
  const fresh = Date.now() - PROCESSING_STALE_MS
  const open = (data ?? []).find((s) => s.status === 'COLLECTING' || Date.parse(s.updated_at) > fresh)
  return open ? { id: open.id, status: open.status } : null
}

/**
 * Records a message in the broker's open submission, opening one when there is none and `mayOpen` allows it.
 * A photo or video is recorded as pending; `setMediaResult` fills it in once fetched. Null when not recorded.
 */
export async function recordMessage(
  db: SupabaseClient,
  brokerId: string,
  senderPhone: string,
  mayOpen: boolean,
  msg: ParsedMessage,
): Promise<OpenSubmission | null> {
  const { data, error } = await db.rpc('record_submission_message', {
    p_broker_id: brokerId,
    p_sender_phone: senderPhone,
    p_may_open: mayOpen,
    p_message: {
      whatsapp_message_id: msg.waMessageId,
      message_type: msg.type,
      text_body: msg.textContent,
      caption: msg.caption,
      media_id: msg.waMediaId,
      media_type: msg.waMediaId ? msg.type : null,
      mime_type: msg.mimeType,
      media_status: msg.waMediaId ? 'pending' : 'none',
      whatsapp_timestamp: msg.receivedAt.toISOString(),
    },
  })

  if (error) throw new Error(`Failed to record message: ${error.message}`)
  const row = (data as Array<{ submission_id: string; submission_status: OpenSubmission['status'] }> | null)?.[0]
  return row ? { id: row.submission_id, status: row.submission_status } : null
}

/** The outcome of fetching a recorded message's photo or video: where it is stored, or null when it failed. */
export async function setMediaResult(db: SupabaseClient, waMessageId: string, storagePath: string | null): Promise<void> {
  const { error } = await db
    .from('whatsapp_submission_messages')
    .update({ media_storage_path: storagePath, media_status: storagePath ? 'ready' : 'failed' })
    .eq('whatsapp_message_id', waMessageId)

  if (error) throw new Error(`Failed to save media result: ${error.message}`)
}

/**
 * COLLECTING → PROCESSING when "done" arrives. The submission stays open for messages until `closeSession`.
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

/**
 * PROCESSING → COMPLETED, linking the property and using up a trial broker's free listing. 'changed' when messages
 * arrived beyond the `seen` the build has taken in; `seen` null closes regardless.
 */
export async function closeSession(
  db: SupabaseClient,
  sessionId: string,
  propertyId: string,
  seen: number | null,
): Promise<'closed' | 'changed' | 'gone'> {
  const { data, error } = await db.rpc('close_submission', {
    p_submission_id: sessionId,
    p_property_id: propertyId,
    p_seen: seen,
  })

  if (error) throw new Error(`Failed to close submission: ${error.message}`)
  return data as 'closed' | 'changed' | 'gone'
}

/** PROCESSING → COLLECTING: nothing to build from yet, so the broker can add to it and send "done" again. */
export async function reopenSession(db: SupabaseClient, sessionId: string): Promise<void> {
  const { error } = await db
    .from('whatsapp_submissions')
    .update({ status: 'COLLECTING', updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('status', 'PROCESSING')

  if (error) throw new Error(`Failed to reopen submission: ${error.message}`)
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

export interface SessionMessage {
  message_type: string
  content: string | null
  storage_path: string | null
  media_status: 'none' | 'pending' | 'ready' | 'failed'
  received_at: string
  /** When we recorded it: a photo still pending long after this is given up on. */
  recorded_at: string
}

/**
 * Fetches all messages for a submission, ordered by whatsapp_timestamp.
 * Returns a shape compatible with aiExtractor (content / storage_path aliases).
 */
export async function getSessionMessages(
  db: SupabaseClient,
  sessionId: string,
): Promise<SessionMessage[]> {
  const { data, error } = await db
    .from('whatsapp_submission_messages')
    .select('message_type, text_body, media_storage_path, media_status, whatsapp_timestamp, created_at')
    .eq('submission_id', sessionId)
    .order('whatsapp_timestamp', { ascending: true, nullsFirst: false })

  if (error) throw new Error(`Failed to fetch messages: ${error.message}`)

  // Alias new column names to the shape aiExtractor expects
  return (data ?? []).map((row) => ({
    message_type: row.message_type,
    content:      row.text_body,
    storage_path: row.media_storage_path,
    media_status: row.media_status ?? 'none',
    received_at:  row.whatsapp_timestamp ?? new Date().toISOString(),
    recorded_at:  row.created_at ?? new Date().toISOString(),
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
