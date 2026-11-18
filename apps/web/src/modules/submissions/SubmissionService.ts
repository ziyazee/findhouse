import { supabase } from '@/lib/supabase'
import type { Submission, SubmissionStatus } from './submission.types'

export interface ISubmissionService {
  list(options?: { status?: SubmissionStatus }): Promise<Submission[]>
  get(id: string): Promise<Submission | null>
  updateStatus(id: string, status: SubmissionStatus): Promise<void>
}

class SupabaseSubmissionService implements ISubmissionService {
  async list({ status }: { status?: SubmissionStatus } = {}): Promise<Submission[]> {
    let query = supabase
      .from('whatsapp_submissions')
      .select('*')
      .order('created_at', { ascending: false })

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
      .update(patch as { status?: string; completed_at?: string })
      .eq('id', id)

    if (error) throw new Error(error.message)
  }
}

function toSubmission(row: { id: string; sender_phone: string; status: string; property_id: string | null; completed_at: string | null; created_at: string }): Submission {
  return {
    id: row.id,
    senderPhone: row.sender_phone,
    status: row.status as SubmissionStatus,
    propertyId: row.property_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }
}

export function createSubmissionService(): ISubmissionService {
  return new SupabaseSubmissionService()
}
