// Shared types used across all Edge Functions

export type MessageClassification = 'GREETING' | 'DONE' | 'PROPERTY_INFO' | 'OTHER'
export type SessionStatus = 'COLLECTING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
export type SubmissionStatus = SessionStatus
export type MessageType = 'text' | 'image' | 'video' | 'document' | 'audio' | 'location'

// ── WhatsApp API payload shapes ───────────────────────────────────────────────

export interface WAWebhookPayload {
  object: string
  entry: WAEntry[]
}

export interface WAEntry {
  id: string
  changes: WAChange[]
}

export interface WAChange {
  value: WAChangeValue
  field: string
}

export interface WAChangeValue {
  messaging_product: string
  metadata: { display_phone_number: string; phone_number_id: string }
  contacts?: WAContact[]
  messages?: WAMessage[]
  statuses?: unknown[]
}

export interface WAContact {
  profile: { name: string }
  wa_id: string
}

export interface WAMessage {
  from: string
  id: string
  timestamp: string
  type: MessageType
  text?: { body: string }
  image?: { id: string; mime_type: string; sha256: string; caption?: string }
  video?: { id: string; mime_type: string; sha256: string }
  document?: { id: string; mime_type: string; filename?: string }
  audio?: { id: string; mime_type: string }
  location?: WALocation
}

/** A location pin the broker shared from WhatsApp's attachment menu. */
export interface WALocation {
  latitude: number
  longitude: number
  name?: string
  address?: string
}

// ── Parsed / normalized message ───────────────────────────────────────────────

export interface ParsedMessage {
  waMessageId: string
  fromNumber: string   // E.164
  type: MessageType
  classification: MessageClassification
  textContent: string | null
  caption: string | null      // image caption from WhatsApp
  waMediaId: string | null
  mimeType: string | null
  receivedAt: Date
}

// ── AI extraction result ──────────────────────────────────────────────────────

export interface ExtractedProperty {
  title: string
  propertyType: string
  listingType: 'sale' | 'rent'
  price: number | null
  location: string | null
  locality: string | null
  bedrooms: number | null
  bathrooms: number | null
  builtUpArea: number | null
  carpetArea: number | null
  furnishing: string | null
  floor: string | null
  totalFloors: number | null
  parking: string | null
  amenities: string[]
  description: string | null
}
