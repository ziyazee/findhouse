import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type { IntakeItem, Submission, SubmissionStatus } from './submission.types'

type SubmissionRow = Database['public']['Tables']['whatsapp_submissions']['Row']
type SubmissionUpdate = Database['public']['Tables']['whatsapp_submissions']['Update']

export interface ISubmissionService {
  list(options?: { status?: SubmissionStatus }): Promise<Submission[]>
  /** A broker's most recent WhatsApp submissions, newest first. */
  listForBroker(brokerId: string, limit: number): Promise<IntakeItem[]>
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

  async listForBroker(brokerId: string, limit: number): Promise<IntakeItem[]> {
    const { data, error } = await supabase
      .from('whatsapp_submissions')
      .select('id, sender_phone, status, failure_reason, property_id, created_at')
      .eq('broker_id', brokerId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => ({
      id: r.id,
      senderPhone: r.sender_phone,
      status: r.status as SubmissionStatus,
      failureReason: r.failure_reason,
      propertyId: r.property_id,
      createdAt: r.created_at,
    }))
  }

  async get(id: string): Promise<Submission | null> {
    const { data, error } = await supabase
      .from('whatsapp_submissions')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data ? toSubmission(data) : null
  }

  async updateStatus(id: string, status: SubmissionStatus): Promise<void> {
    const patch: SubmissionUpdate = { status }
    if (status === 'COMPLETED') patch.completed_at = new Date().toISOString()

    const { error } = await supabase.from('whatsapp_submissions').update(patch).eq('id', id)
    if (error) throw new Error(error.message)
  }
}

function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    senderPhone: row.sender_phone,
    status: row.status as SubmissionStatus,
    propertyId: row.property_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }
}

export const submissionService: ISubmissionService = new SupabaseSubmissionService()
