import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { Plan, ReplyKind } from './conversation.ts'

export type BrokerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED'

export interface ResolvedBroker {
  id: string
  status: BrokerStatus
  plan: Plan
  welcomed: boolean
  trialUsed: boolean
}

/**
 * Looks up a broker by WhatsApp phone number.
 * Creates a new ACTIVE broker record if none exists (on the trial plan, by the column default).
 *
 * Safe under concurrent webhook events: the INSERT uses ON CONFLICT DO NOTHING
 * (ignoreDuplicates) so simultaneous events for the same unknown number produce
 * exactly one broker row. The subsequent SELECT always finds the row.
 *
 * Returns null only if the row cannot be read after the upsert (shouldn't happen
 * in practice, but callers must guard against it).
 *
 * INACTIVE and BLOCKED brokers are returned as-is — the caller decides whether
 * to reject the message.
 */
export async function resolveBroker(
  db: SupabaseClient,
  phone: string,
): Promise<ResolvedBroker | null> {
  // Atomic insert — does nothing if the phone number already exists.
  // Status is only set on the initial insert; an existing record keeps its status.
  const { error: upsertError } = await db
    .from('brokers')
    .upsert({ phone, status: 'ACTIVE' }, { onConflict: 'phone', ignoreDuplicates: true })

  if (upsertError) {
    throw new Error(`[brokerManager] Upsert failed for ${phone}: ${upsertError.message}`)
  }

  const { data, error: selectError } = await db
    .from('brokers')
    .select('id, status, plan, welcomed_at, trial_used_at')
    .eq('phone', phone)
    .single()

  if (selectError || !data) {
    console.error(`[brokerManager] Could not read broker for ${phone}:`, selectError?.message)
    return null
  }

  return {
    id: data.id as string,
    status: data.status as BrokerStatus,
    plan: data.plan === 'trial' ? 'trial' : 'paid',
    welcomed: data.welcomed_at != null,
    trialUsed: data.trial_used_at != null,
  }
}

/** Records the broker's latest WhatsApp message; an automatic reply only answers the latest one. */
export async function noteInboundMessage(db: SupabaseClient, brokerId: string, waMessageId: string): Promise<void> {
  const { error } = await db.from('brokers').update({ last_inbound_message_id: waMessageId }).eq('id', brokerId)
  if (error) console.error(`[brokerManager] Could not note message ${waMessageId}:`, error.message)
}

/**
 * Claims the right to send `kind` in answer to `waMessageId` (see claim_auto_reply in migration 013).
 * False when a newer message arrived, the message was already answered, or the reply's limit is reached.
 */
export async function claimAutoReply(
  db: SupabaseClient,
  brokerId: string,
  waMessageId: string,
  kind: ReplyKind,
): Promise<boolean> {
  const { data, error } = await db.rpc('claim_auto_reply', {
    claim_broker_id: brokerId,
    message_id: waMessageId,
    reply_kind: kind,
  })
  if (error) {
    console.error(`[brokerManager] claim_auto_reply failed for ${waMessageId}:`, error.message)
    return false
  }
  return data === true
}
