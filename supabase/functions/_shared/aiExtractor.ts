import type { ExtractedProperty } from './types.ts'

// Matches the shape returned by getSessionMessages (aliased column names)
interface SessionMessage {
  message_type: string
  content: string | null       // text_body aliased
  storage_path: string | null  // media_storage_path aliased
}

const EXTRACTION_PROMPT = `You are a real estate data extraction assistant. A property broker has sent you messages and media about a property via WhatsApp. Extract all available property information from the messages below and return it as valid JSON.

Rules:
- Never invent or guess missing information. Leave unavailable fields as null.
- If the broker did not mention a field, it must be null.
- Preserve the original values exactly (e.g. prices, area measurements).
- For amenities, return a flat array of strings (e.g. ["Swimming pool", "Gym", "Parking"]).
- For listingType: use "sale" if it's a property for sale/purchase, "rent" if it's for rent/lease.
- For description: write a concise 2-3 sentence summary using only information provided.
- propertyType examples: Apartment, Villa, Independent House, Plot, Commercial Space, Office, Shop, Warehouse.

Return ONLY valid JSON matching this exact schema. No other text:
{
  "title": "string — short descriptive title",
  "propertyType": "string",
  "listingType": "sale" | "rent",
  "price": number | null,
  "location": "string — city or area" | null,
  "locality": "string — neighbourhood or street" | null,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "builtUpArea": number | null,
  "carpetArea": number | null,
  "furnishing": "unfurnished" | "semi-furnished" | "fully-furnished" | null,
  "floor": "string" | null,
  "totalFloors": number | null,
  "parking": "string" | null,
  "amenities": ["string"],
  "description": "string" | null
}`

export async function extractPropertyData(
  messages: SessionMessage[],
  _supabaseUrl?: string,
): Promise<ExtractedProperty> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  // Build the message content — text messages inline, images as URLs
  const contentParts: Array<{ type: string; text?: string; source?: unknown }> = []

  const textMessages = messages
    .filter((m) => m.message_type === 'text' && m.content)
    .map((m) => m.content!)
    .join('\n\n')

  if (textMessages) {
    contentParts.push({ type: 'text', text: `Broker messages:\n${textMessages}` })
  }

  // Add images (Supabase Storage public URLs)
  const imageMessages = messages.filter(
    (m) => m.message_type === 'image' && m.storage_path,
  )

  for (const img of imageMessages) {
    const r2PublicUrl = Deno.env.get('R2_PUBLIC_URL')!
    const publicUrl = `${r2PublicUrl}/${img.storage_path}`
    contentParts.push({
      type: 'image',
      source: { type: 'url', url: publicUrl },
    })
  }

  if (contentParts.length === 0) {
    throw new Error('No content to extract from — session has no property information')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: EXTRACTION_PROMPT,
      messages: [{ role: 'user', content: contentParts }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error ${response.status}: ${err}`)
  }

  const result = await response.json()
  const rawText: string = result.content?.[0]?.text ?? ''

  try {
    // Strip any accidental markdown code fences
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(jsonText) as ExtractedProperty
    return parsed
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${rawText.slice(0, 200)}`)
  }
}
