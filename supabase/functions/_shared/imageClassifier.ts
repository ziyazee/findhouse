/**
 * OpenAI Vision image classifier.
 *
 * Sends all images for a property in a single API call and returns one
 * classification result per image. Using a single call rather than one
 * per image: (a) costs less — prompt tokens are shared, (b) is faster,
 * (c) gives the model cross-image context for cover selection.
 *
 * Model: gpt-4o-mini  (cheapest vision model with json_schema output)
 * Detail: "low"       (85 tokens/image; downscales to 512×512 — sufficient
 *                      for room-type classification of ordinary real-estate photos)
 *
 * Note: OpenAI supports detail values "low" | "high" | "auto". "medium" is
 * not a valid value; "low" is the appropriate cost-efficient choice here.
 */

export interface ImageInput {
  id: string          // property_media.id — returned verbatim in results
  base64: string      // raw base64, no data-URI prefix
  mimeType: string    // image/jpeg | image/png | image/webp
}

export type ImageCategory =
  | 'COVER'
  | 'LIVING_ROOM'
  | 'BEDROOM'
  | 'KITCHEN'
  | 'BATHROOM'
  | 'BALCONY'
  | 'EXTERIOR'
  | 'FLOOR_PLAN'
  | 'AMENITIES'
  | 'PARKING'
  | 'OTHER'

export interface ImageClassification {
  image_id:    string
  category:    ImageCategory
  description: string   // short factual description — no invented details
  confidence:  number   // 0–1
}

export interface ClassificationResult {
  classifications: ImageClassification[]
  cover_image_id:  string | null   // id of the recommended cover image
  usage: {
    prompt_tokens:     number
    completion_tokens: number
    total_tokens:      number
  }
  model: string
}

// ── Config ────────────────────────────────────────────────────────────────────

interface ClassifierConfig {
  model:       string
  imageDetail: 'low' | 'high' | 'auto'
  maxRetries:  number
}

function getConfig(): ClassifierConfig {
  return {
    model:       Deno.env.get('OPENAI_IMAGE_MODEL') ?? 'gpt-4o-mini',
    imageDetail: 'low',
    maxRetries:  2,
  }
}

// ── JSON Schema for structured output ─────────────────────────────────────────

const VALID_CATEGORIES: ImageCategory[] = [
  'COVER', 'LIVING_ROOM', 'BEDROOM', 'KITCHEN', 'BATHROOM',
  'BALCONY', 'EXTERIOR', 'FLOOR_PLAN', 'AMENITIES', 'PARKING', 'OTHER',
]

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    classifications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          image_id:    { type: 'string' },
          category:    { type: 'string', enum: VALID_CATEGORIES },
          description: { type: 'string' },
          confidence:  { type: 'number' },
        },
        required: ['image_id', 'category', 'description', 'confidence'],
        additionalProperties: false,
      },
    },
    cover_image_id: {
      // null when no suitable cover exists
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
  },
  required: ['classifications', 'cover_image_id'],
  additionalProperties: false,
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a real estate image classifier. You receive property images and return structured JSON.

CATEGORIES (use exactly one per image):
- BEDROOM: bedroom with bed visible
- LIVING_ROOM: living/sitting room (sofas, coffee table, TV area)
- KITCHEN: kitchen area; classify as KITCHEN even if only partially visible
- BATHROOM: bathroom, toilet, shower or bath area
- BALCONY: balcony, terrace or outdoor area attached to a unit
- EXTERIOR: building facade, entrance, street view, garden, compound
- FLOOR_PLAN: architectural drawing or floor plan diagram
- AMENITIES: gym, pool, clubhouse, playground or shared facilities
- PARKING: parking space, garage, carport
- OTHER: image does not clearly fit any category above

COVER: After classifying all images, choose ONE as the best property cover.
- Prefer clear, well-lit EXTERIOR or LIVING_ROOM images.
- Never choose FLOOR_PLAN, PARKING or blurry images as cover if better options exist.
- Set cover_image_id to the chosen image's id, or null if nothing suitable.

Rules:
- Do NOT classify a bedroom as LIVING_ROOM just because it has a sofa or television.
- Confidence is your probability estimate (0.0 to 1.0).
- Description must be factual and short (max 12 words). Do not invent details not visible.
- Preserve each image_id exactly as given.`

// ── OpenAI call ───────────────────────────────────────────────────────────────

export async function classifyImages(
  images: ImageInput[],
): Promise<ClassificationResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const cfg = getConfig()

  // Build content array: one text prompt + one image_url block per image
  const userContent: unknown[] = [
    {
      type: 'text',
      text: `Classify these ${images.length} property image${images.length > 1 ? 's' : ''}. ` +
            `Return a classification for each image_id in the order given.`,
    },
    ...images.map((img) => ({
      type: 'image_url',
      image_url: {
        url:    `data:${img.mimeType};base64,${img.base64}`,
        detail: cfg.imageDetail,
      },
    })),
  ]

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential back-off: 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)))
      console.log(`[imageClassifier] Retry ${attempt}/${cfg.maxRetries}`)
    }

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: userContent },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name:   'property_image_classifications',
              strict: true,
              schema: RESPONSE_SCHEMA,
            },
          },
          // 80 tokens per image (category + description + confidence) + overhead
          max_tokens: Math.max(500, images.length * 100),
        }),
      })

      if (res.status === 429 || res.status >= 500) {
        // Rate limit or server error — retry
        const text = await res.text()
        lastError = new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`)
        continue
      }

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`OpenAI API error ${res.status}: ${text.slice(0, 400)}`)
      }

      const json = await res.json() as {
        model: string
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
        choices: Array<{ message: { content: string } }>
      }

      const raw = json.choices?.[0]?.message?.content ?? ''

      let parsed: { classifications: ImageClassification[]; cover_image_id: string | null }
      try {
        parsed = JSON.parse(raw)
      } catch {
        throw new Error(`Failed to parse OpenAI response as JSON: ${raw.slice(0, 200)}`)
      }

      // Validate returned image_ids match inputs
      const inputIds = new Set(images.map((i) => i.id))
      for (const c of parsed.classifications ?? []) {
        if (!inputIds.has(c.image_id)) {
          console.warn(`[imageClassifier] Unknown image_id in response: ${c.image_id}`)
        }
        // Clamp confidence
        c.confidence = Math.min(1, Math.max(0, Number(c.confidence) || 0))
      }

      return {
        classifications: parsed.classifications ?? [],
        cover_image_id:  parsed.cover_image_id ?? null,
        usage:           json.usage,
        model:           json.model,
      }
    } catch (err) {
      if (err instanceof Error && (err.message.includes('429') || err.message.includes('500'))) {
        lastError = err
        continue
      }
      throw err  // non-retriable — propagate immediately
    }
  }

  throw lastError ?? new Error('OpenAI classification failed after retries')
}

// ── Cost estimate ─────────────────────────────────────────────────────────────

/** Returns an approximate USD cost for a gpt-4o-mini classification run. */
export function estimateCost(usage: { prompt_tokens: number; completion_tokens: number }): number {
  // gpt-4o-mini pricing (as of mid-2025): $0.150/1M input, $0.600/1M output
  const inputCost  = (usage.prompt_tokens     / 1_000_000) * 0.150
  const outputCost = (usage.completion_tokens / 1_000_000) * 0.600
  return parseFloat((inputCost + outputCost).toFixed(6))
}
