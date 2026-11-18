import { supabase } from '@/lib/supabase'
import type { SubmissionMessage } from './submission.types'
import type { WhatsappSubmissionMessageRow } from '@/lib/database.types'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface ISubmissionMessageService {
  getForSubmission(submissionId: string): Promise<SubmissionMessage[]>
}

// ── Supabase implementation ───────────────────────────────────────────────────

class SupabaseSubmissionMessageService implements ISubmissionMessageService {
  async getForSubmission(submissionId: string): Promise<SubmissionMessage[]> {
    const { data, error } = await supabase
      .from('whatsapp_submission_messages')
      .select('*')
      .eq('submission_id', submissionId)
      .order('whatsapp_timestamp', { ascending: true, nullsFirst: false })

    if (error) throw new Error(error.message)
    return (data ?? []).map(toMessage)
  }
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function toMessage(row: WhatsappSubmissionMessageRow): SubmissionMessage {
  return {
    id: row.id,
    submissionId: row.submission_id,
    whatsappMessageId: row.whatsapp_message_id,
    messageType: row.message_type,
    textBody: row.text_body,
    mediaId: row.media_id,
    mediaType: row.media_type,
    mimeType: row.mime_type,
    mediaStoragePath: row.media_storage_path,
    caption: row.caption,
    whatsappTimestamp: row.whatsapp_timestamp,
    createdAt: row.created_at,
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createSubmissionMessageService(): ISubmissionMessageService {
  return new SupabaseSubmissionMessageService()
}
