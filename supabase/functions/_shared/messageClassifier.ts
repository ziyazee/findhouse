import type { MessageClassification, WAMessage } from './types.ts'

// Single-word / short greetings we recognise
const GREETING_PATTERNS = [
  /^(hi+|hey+|hello+|helo+|hii+|helo)[\s!.,]*$/i,
  /^good\s+(morning|afternoon|evening|day|night)[\s!.,]*$/i,
  /^(namaste|namaskar|salaam|salam|assalam|assalamualaikum)[\s!.,]*$/i,
  /^(howdy|greetings|sup|yo)[\s!.,]*$/i,
  /^(ok|okay|k|fine|sure|noted|thanks|thank you|thx|ty)[\s!.,]*$/i,
]

/** "done" must be exact (case-insensitive, optional trailing punctuation). */
export function isDoneText(text: string): boolean {
  return /^done[.!,\s]*$/i.test(text.trim())
}

export function classifyMessage(message: WAMessage): MessageClassification {
  // Media messages are always property info
  if (message.type !== 'text') return 'PROPERTY_INFO'

  const raw = message.text?.body ?? ''
  const trimmed = raw.trim()

  if (!trimmed) return 'OTHER'

  if (isDoneText(trimmed)) return 'DONE'

  // Check greeting patterns
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) return 'GREETING'
  }

  // Anything else with real content is property info
  return 'PROPERTY_INFO'
}
