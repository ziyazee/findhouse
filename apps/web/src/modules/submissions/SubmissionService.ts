import { supabase } from '@/lib/supabase'
import type { Submission, SubmissionStatus } from './submission.types'
import type { WhatsappSubmissionRow } from '@/lib/database.types'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface ISubmissionService {
  list(options?: { status?: SubmissionStatus }): Promise<Submission[]>
  get(id: string): Promise<Submission | null>
  updateStatus(id: string, status: SubmissionStatus): Promise<void>
}

// ── Supabase implementation ───────────────────────────────────────────────────

class SupabaseSubmissionService implements ISubmissionService {
  async list({ status }: { status?: SubmissionStatus } = {}): Promise<Submission[]> {
    let query = supabase
      .from('whatsapp_submissions')
      .select('*')
      .order('started_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []).map(toSubmission)
  }

  async get(id: string): Promise<Submission | null> {
    const { data, error } = await supabase
      .from('whatsapp_submissions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return null
    return toSubmission(data)
  }

  async updateStatus(id: string, status: SubmissionStatus): Promise<void> {
    const patch: Record<string, string> = { status }
    if (status === 'COMPLETED') patch.completed_at = new Date().toISOString()

    const { error } = await supabase
      .from('whatsapp_submissions')
      .update(patch)
      .eq('id', id)

    if (error) throw new Error(error.message)
  }
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function toSubmission(row: WhatsappSubmissionRow): Submission {
  return {
    id: row.id,
    senderPhone: row.sender_phone,
    status: row.status,
    propertyId: row.property_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createSubmissionService(): ISubmissionService {
  return new SupabaseSubmissionService()
}
