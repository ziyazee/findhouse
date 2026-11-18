// Generated from actual Supabase project: ajvihzaaaqvvuedasmve
// To regenerate: npx supabase gen types typescript --project-id ajvihzaaaqvvuedasmve > src/lib/database.types.ts

export type SubmissionStatus = 'COLLECTING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
export type MessageType = 'text' | 'image' | 'video' | 'command'

export interface WhatsappSubmissionRow {
  id: string
  sender_phone: string
  status: SubmissionStatus
  broker_id: string | null
  property_id: string | null
  failure_reason: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface WhatsappSubmissionMessageRow {
  id: string
  submission_id: string
  whatsapp_message_id: string
  message_type: MessageType
  text_body: string | null
  media_id: string | null
  media_type: string | null
  mime_type: string | null
  media_storage_path: string | null
  caption: string | null
  whatsapp_timestamp: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      whatsapp_submissions: {
        Row: WhatsappSubmissionRow
        Insert: Omit<WhatsappSubmissionRow, 'id' | 'created_at' | 'started_at'> & {
          id?: string
          started_at?: string
          created_at?: string
        }
        Update: Partial<Pick<WhatsappSubmissionRow, 'status' | 'completed_at'>>
      }
      whatsapp_submission_messages: {
        Row: WhatsappSubmissionMessageRow
        Insert: Omit<WhatsappSubmissionMessageRow, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<WhatsappSubmissionMessageRow>
      }
    }
    Views: Record<string, unknown>
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
  }
}
