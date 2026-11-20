export type SubmissionStatus = 'COLLECTING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
export type MessageType = 'text' | 'image' | 'video' | 'command'

export interface Submission {
  id: string
  senderPhone: string
  status: SubmissionStatus
  propertyId: string | null
  completedAt: string | null
  createdAt: string
  messageCount?: number
}

/** A submission as the dashboard lists it: enough to show progress and link to the property. */
export interface IntakeItem {
  id: string
  senderPhone: string
  status: SubmissionStatus
  failureReason: string | null
  propertyId: string | null
  createdAt: string
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
