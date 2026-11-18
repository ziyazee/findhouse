import type { SubmissionStatus, MessageType } from '@/lib/database.types'

// Re-export for convenience
export type { SubmissionStatus, MessageType }

// ── Domain models (camelCase) ─────────────────────────────────────────────────

export interface Submission {
  id: string
  senderPhone: string
  status: SubmissionStatus
  propertyId: string | null
  startedAt: string
  completedAt: string | null
  createdAt: string
  messageCount?: number
}

export interface SubmissionMessage {
  id: string
  submissionId: string
  whatsappMessageId: string
  messageType: MessageType
  textBody: string | null
  mediaId: string | null
  mediaType: string | null
  mimeType: string | null
  mediaStoragePath: string | null
  caption: string | null
  whatsappTimestamp: string | null
  createdAt: string
}
