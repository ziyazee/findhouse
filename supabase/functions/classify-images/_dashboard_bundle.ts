// ============================================================
// classify-images — Dashboard bundle (single file, no imports from _shared)
// Paste this entire file into the Supabase Dashboard editor.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImageInput { id: string; base64: string; mimeType: string }

type ImageCategory =
  | 'COVER' | 'LIVING_ROOM' | 'BEDROOM' | 'KITCHEN' | 'BATHROOM'
  | 'BALCONY' | 'EXTERIOR' | 'FLOOR_PLAN' | 'AMENITIES' | 'PARKING' | 'OTHER'

interface ImageClassification {
  image_id: string; category: ImageCategory; description: string; confidence: number
}

interface ClassificationResult {
  classifications: ImageClassification[]
  cover_image_id: string | null
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  model: string
}

// ── Image classifier ──────────────────────────────────────────────────────────

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
    cover_image_id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
  required: ['classifications', 'cover_image_id'],
  additionalProperties: false,
}

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

async function classifyImages(images: ImageInput[]): Promise<ClassificationResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const model       = Deno.env.get('OPENAI_IMAGE_MODEL') ?? 'gpt-4o-mini'
  const maxRetries  = 2

  const userContent: unknown[] = [
    { type: 'text', text: `Classify these ${images.length} property image${images.length > 1 ? 's' : ''}. The image_ids in order are: ${images.map((i) => i.id).join(', ')}. Return a classification for each image_id exactly as given.` },
    ...images.map((img) => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: 'low' } })),
  ]

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)))
      console.log(`[imageClassifier] Retry ${attempt}/${maxRetries}`)
    }

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userContent }],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'property_image_classifications', strict: true, schema: RESPONSE_SCHEMA },
          },
          max_tokens: Math.max(500, images.length * 100),
        }),
      })

      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`)
        continue
      }

      if (!res.ok) { const text = await res.text(); throw new Error(`OpenAI API error ${res.status}: ${text.slice(0, 400)}`) }

      const json = await res.json() as {
        model: string
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
        choices: Array<{ message: { content: string } }>
      }

      const raw = json.choices?.[0]?.message?.content ?? ''
      let parsed: { classifications: ImageClassification[]; cover_image_id: string | null }
      try { parsed = JSON.parse(raw) } catch { throw new Error(`Failed to parse OpenAI response as JSON: ${raw.slice(0, 200)}`) }

      const inputIds = new Set(images.map((i) => i.id))
      for (const c of parsed.classifications ?? []) {
        if (!inputIds.has(c.image_id)) console.warn(`[imageClassifier] Unknown image_id in response: ${c.image_id}`)
        c.confidence = Math.min(1, Math.max(0, Number(c.confidence) || 0))
      }

      return { classifications: parsed.classifications ?? [], cover_image_id: parsed.cover_image_id ?? null, usage: json.usage, model: json.model }
    } catch (err) {
      if (err instanceof Error && (err.message.includes('429') || err.message.includes('500'))) { lastError = err; continue }
      throw err
    }
  }

  throw lastError ?? new Error('OpenAI classification failed after retries')
}

function estimateCost(usage: { prompt_tokens: number; completion_tokens: number }): number {
  return parseFloat(((usage.prompt_tokens / 1_000_000) * 0.150 + (usage.completion_tokens / 1_000_000) * 0.600).toFixed(6))
}

// ── Bounded concurrency ───────────────────────────────────────────────────────

async function runBounded<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<(R | Error)[]> {
  const results: (R | Error)[] = new Array(items.length)
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      try { results[i] = await fn(items[i]) }
      catch (err) { results[i] = err instanceof Error ? err : new Error(String(err)) }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

function guessMimeType(storagePath: string): string {
  const ext = storagePath.split('.').pop()?.toLowerCase()
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as Record<string, string>)[ext ?? ''] ?? 'image/jpeg'
}

// ── Main ──────────────────────────────────────────────────────────────────────

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const BUCKET              = 'property-media'
const DOWNLOAD_CONCURRENCY = parseInt(Deno.env.get('CLASSIFY_DOWNLOAD_CONCURRENCY') ?? '4')

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let propertyId: string
  try {
    const body = await req.json() as { propertyId?: string }
    if (!body.propertyId) throw new Error('propertyId is required')
    propertyId = body.propertyId
  } catch (err) { return new Response(String(err), { status: 400 }) }

  console.log(`[classify-images] Starting for property: ${propertyId}`)

  const { data: property, error: propError } = await db.from('properties').select('id, image_classification_status').eq('id', propertyId).single()
  if (propError || !property) return new Response('Property not found', { status: 404 })

  if (property.image_classification_status === 'PROCESSING') {
    console.warn(`[classify-images] Already PROCESSING for ${propertyId} — skipping`)
    return new Response(JSON.stringify({ ok: true, skipped: 'already_processing' }), { headers: { 'Content-Type': 'application/json' } })
  }
  if (property.image_classification_status === 'COMPLETED') {
    console.log(`[classify-images] Already COMPLETED for ${propertyId} — nothing to do`)
    return new Response(JSON.stringify({ ok: true, skipped: 'already_completed' }), { headers: { 'Content-Type': 'application/json' } })
  }

  await db.from('properties').update({ image_classification_status: 'PROCESSING' }).eq('id', propertyId)

  const startedAt = Date.now()

  try {
    // Fetch unclassified images
    const { data: allMedia, error: mediaError } = await db.from('property_media').select('id, storage_path, media_type, category').eq('property_id', propertyId).eq('media_type', 'image').order('display_order', { ascending: true })
    if (mediaError) throw new Error(`Failed to fetch media: ${mediaError.message}`)

    const allImages  = allMedia ?? []
    const totalCount = allImages.length

    if (totalCount === 0) {
      await db.from('properties').update({ image_classification_status: 'COMPLETED', image_classification_metadata: { total_images: 0, processed_at: new Date().toISOString() } }).eq('id', propertyId)
      return new Response(JSON.stringify({ ok: true, status: 'COMPLETED', totalCount: 0 }), { headers: { 'Content-Type': 'application/json' } })
    }

    const unclassified = allImages.filter((m) => m.category === null || m.category === undefined)
    const skippedCount = totalCount - unclassified.length

    if (unclassified.length === 0) {
      console.log(`[classify-images] All ${totalCount} images already classified — skipping`)
      await db.from('properties').update({ image_classification_status: 'COMPLETED' }).eq('id', propertyId)
      return new Response(JSON.stringify({ ok: true, status: 'COMPLETED', skippedCount }), { headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`[classify-images] ${unclassified.length} unclassified images (${skippedCount} already done)`)

    // Download images with bounded concurrency
    const downloadResults = await runBounded(
      unclassified,
      async (row) => {
        const { data: blob, error } = await db.storage.from(BUCKET).download(row.storage_path)
        if (error || !blob) throw new Error(`Storage download failed for ${row.storage_path}: ${error?.message}`)
        const uint8  = new Uint8Array(await blob.arrayBuffer())
        const base64 = btoa(uint8.reduce((acc, byte) => acc + String.fromCharCode(byte), ''))
        return { id: row.id, base64, mimeType: guessMimeType(row.storage_path) } satisfies ImageInput
      },
      DOWNLOAD_CONCURRENCY,
    )

    const successfulDownloads: ImageInput[] = []
    const downloadErrors: string[] = []
    downloadResults.forEach((res, idx) => {
      if (res instanceof Error) downloadErrors.push(`${unclassified[idx].storage_path}: ${res.message}`)
      else successfulDownloads.push(res)
    })

    if (successfulDownloads.length === 0) throw new Error(`All ${unclassified.length} image downloads failed: ${downloadErrors.join('; ')}`)

    console.log(`[classify-images] Downloaded ${successfulDownloads.length}/${unclassified.length} images`)

    const result = await classifyImages(successfulDownloads)
    console.log(`[classify-images] OpenAI returned ${result.classifications.length} results using ${result.usage.total_tokens} tokens`)

    // Persist results
    const classificationMap = new Map(result.classifications.map((c) => [c.image_id, c]))
    let classifiedCount = 0
    const persistErrors: string[] = []

    for (const img of successfulDownloads) {
      const c = classificationMap.get(img.id)
      if (!c) { persistErrors.push(`No classification returned for image ${img.id}`); continue }
      const { error: updateError } = await db.from('property_media').update({ category: c.category, ai_description: c.description, ai_confidence: c.confidence }).eq('id', img.id)
      if (updateError) persistErrors.push(`Failed to update ${img.id}: ${updateError.message}`)
      else classifiedCount++
    }

    // Update cover image
    if (result.cover_image_id) {
      await db.from('property_media').update({ is_cover: false }).eq('property_id', propertyId).eq('media_type', 'image')
      const { error: coverError } = await db.from('property_media').update({ is_cover: true }).eq('id', result.cover_image_id)
      if (coverError) console.warn(`[classify-images] Failed to set cover: ${coverError.message}`)
      else {
        await db.from('properties').update({ cover_image_id: result.cover_image_id }).eq('id', propertyId)
        console.log(`[classify-images] Cover image set: ${result.cover_image_id}`)
      }
    }

    const failedCount  = (unclassified.length - successfulDownloads.length) + (successfulDownloads.length - classifiedCount)
    const allErrors    = [...downloadErrors, ...persistErrors]
    const finalStatus  = failedCount === 0 ? 'COMPLETED' : classifiedCount === 0 ? 'FAILED' : 'PARTIAL_FAILURE'
    const durationMs   = Date.now() - startedAt
    const cost         = estimateCost(result.usage)

    await db.from('properties').update({
      image_classification_status: finalStatus,
      image_classification_metadata: {
        model: result.model, total_images: totalCount, classified_images: classifiedCount,
        failed_images: failedCount, skipped_images: skippedCount,
        prompt_tokens: result.usage.prompt_tokens, completion_tokens: result.usage.completion_tokens,
        total_tokens: result.usage.total_tokens, estimated_cost_usd: cost,
        duration_ms: durationMs, processed_at: new Date().toISOString(), errors: allErrors,
      },
    }).eq('id', propertyId)

    console.log(`[classify-images] ${finalStatus} — ${classifiedCount}/${totalCount} in ${durationMs}ms, $${cost} USD`)

    return new Response(JSON.stringify({ ok: true, status: finalStatus, totalCount, classifiedCount, failedCount, skippedCount }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error(`[classify-images] Fatal error for ${propertyId}: ${reason}`)
    await db.from('properties').update({ image_classification_status: 'FAILED', image_classification_metadata: { error: reason, duration_ms: Date.now() - startedAt, processed_at: new Date().toISOString() } }).eq('id', propertyId)
    return new Response(JSON.stringify({ ok: false, error: reason }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
