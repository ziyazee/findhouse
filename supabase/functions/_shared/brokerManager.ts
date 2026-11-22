import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { Plan } from './conversation.ts'

export type BrokerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED'

export interface ResolvedBroker {
  id: string
  status: BrokerStatus
  plan: Plan
  trialUsed: boolean
}

/**
 * Looks up a broker by WhatsApp phone number. Invite-only: brokers are added by FindHouse staff in the admin page,
 * so a number that isn't there returns null and its messages are ignored (nothing is created, nothing is sent back).
 *
 * INACTIVE and BLOCKED brokers are returned as-is — the caller decides whether to reject the message.
 */
export async function resolveBroker(
  db: SupabaseClient,
  phone: string,
): Promise<ResolvedBroker | null> {
  const { data, error } = await db
    .from('brokers')
    .select('id, status, plan, trial_used_at')
    .eq('phone', phone)
    .maybeSingle()

  if (error) throw new Error(`[brokerManager] Could not read broker for ${phone}: ${error.message}`)
  if (!data) return null

  return {
    id: data.id as string,
    status: data.status as BrokerStatus,
    plan: data.plan === 'trial' ? 'trial' : 'paid',
    trialUsed: data.trial_used_at != null,
  }
}
