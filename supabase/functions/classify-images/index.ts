/**
 * classify-images — Edge Function
 *
 * Classifies all property images using OpenAI Vision and stores results in
 * property_media. Called fire-and-forget from process-submission after the
 * property record is created.
 *
 * Idempotent: already-classified images (category IS NOT NULL) are skipped,
 * so retrying a PARTIAL_FAILURE re-processes only the failed images.
 *
 * Concurrency: DOWNLOAD_CONCURRENCY (default 4) controls how many images are
 * fetched from Storage in parallel before the single OpenAI batch call.
 */

import { createClient }            from 'https://esm.sh/@supabase/supabase-js@2'
import { classifyImages, estimateCost } from '../_shared/imageClassifier.ts'
import type { ImageInput }          from '../_shared/imageClassifier.ts'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const R2_PUBLIC_URL        = Deno.env.get('R2_PUBLIC_URL')!
const DOWNLOAD_CONCURRENCY = parseInt(Deno.env.get('CLASSIFY_DOWNLOAD_CONCURRENCY') ?? '4')

// ── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let propertyId: string
  try {
    const body = await req.json() as { propertyId?: string }
    if (!body.propertyId) throw new Error('propertyId is required')
    propertyId = body.propertyId
  } catch (err) {
    return new Response(String(err), { status: 400 })
  }

  console.log(`[classify-images] Starting for property: ${propertyId}`)

  // ── 1. Guard: skip if already PROCESSING or COMPLETED ────────────────────
  const { data: property, error: propError } = await db
    .from('properties')
    .select('id, image_classification_status')
    .eq('id', propertyId)
    .single()

  if (propError || !property) {
    return new Response('Property not found', { status: 404 })
  }

  if (property.image_classification_status === 'PROCESSING') {
    console.warn(`[classify-images] Already PROCESSING for ${propertyId} — skipping`)
    return new Response(JSON.stringify({ ok: true, skipped: 'already_processing' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (property.image_classification_status === 'COMPLETED') {
    console.log(`[classify-images] Already COMPLETED for ${propertyId} — nothing to do`)
    return new Response(JSON.stringify({ ok: true, skipped: 'already_completed' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 2. Mark PROCESSING ────────────────────────────────────────────────────
  await db
    .from('properties')
    .update({ image_classification_status: 'PROCESSING' })
    .eq('id', propertyId)

  const startedAt = Date.now()

  try {
    const result = await classifyProperty(propertyId)

    const durationMs = Date.now() - startedAt
    const cost       = estimateCost(result.usage)

    const finalStatus = result.failedCount === 0
      ? 'COMPLETED'
      : result.classifiedCount === 0
        ? 'FAILED'
        : 'PARTIAL_FAILURE'

    await db.from('properties').update({
      image_classification_status:  finalStatus,
      image_classification_metadata: {
        model:              result.model,
        total_images:       result.totalCount,
        classified_images:  result.classifiedCount,
        failed_images:      result.failedCount,
        skipped_images:     result.skippedCount,
        prompt_tokens:      result.usage.prompt_tokens,
        completion_tokens:  result.usage.completion_tokens,
        total_tokens:       result.usage.total_tokens,
        estimated_cost_usd: cost,
        duration_ms:        durationMs,
        processed_at:       new Date().toISOString(),
        errors:             result.errors,
      },
    }).eq('id', propertyId)

    console.log(
      `[classify-images] ${finalStatus} — ${result.classifiedCount}/${result.totalCount} ` +
      `in ${durationMs}ms, $${cost} USD`,
    )

    return new Response(
      JSON.stringify({ ok: true, status: finalStatus, ...result }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error(`[classify-images] Fatal error for ${propertyId}: ${reason}`)

    await db.from('properties').update({
      image_classification_status:   'FAILED',
      image_classification_metadata: {
        error:        reason,
        duration_ms:  Date.now() - startedAt,
        processed_at: new Date().toISOString(),
      },
    }).eq('id', propertyId)

    return new Response(
      JSON.stringify({ ok: false, error: reason }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

// ── Core classification logic ─────────────────────────────────────────────────

interface ClassifyResult {
  totalCount:      number
  classifiedCount: number
  failedCount:     number
  skippedCount:    number
  model:           string
  usage:           { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  errors:          string[]
}

async function classifyProperty(propertyId: string): Promise<ClassifyResult> {
  // ── Fetch all image rows for this property ──────────────────────────────
  const { data: allMedia, error: mediaError } = await db
    .from('property_media')
    .select('id, storage_path, media_type, category')
    .eq('property_id', propertyId)
    .eq('media_type', 'image')
    .order('display_order', { ascending: true })

  if (mediaError) throw new Error(`Failed to fetch media: ${mediaError.message}`)

  const allImages  = allMedia ?? []
  const totalCount = allImages.length

  if (totalCount === 0) {
    console.log(`[classify-images] No images for ${propertyId}`)
    return {
      totalCount: 0, classifiedCount: 0, failedCount: 0, skippedCount: 0,
      model: '', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, errors: [],
    }
  }

  // Skip already-classified images (idempotent retry)
  const unclassified = allImages.filter((m) => m.category === null || m.category === undefined)
  const skippedCount = totalCount - unclassified.length

  if (unclassified.length === 0) {
    console.log(`[classify-images] All ${totalCount} images already classified — skipping`)
    return {
      totalCount, classifiedCount: 0, failedCount: 0, skippedCount,
      model: '', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, errors: [],
    }
  }

  console.log(
    `[classify-images] ${unclassified.length} unclassified images ` +
    `(${skippedCount} already done)`,
  )

  // ── Download images from Storage in bounded batches ─────────────────────
  const downloadResults = await runBounded(
    unclassified,
    async (row) => {
      const res = await fetch(`${R2_PUBLIC_URL}/${row.storage_path}`)

      if (!res.ok) {
        throw new Error(`R2 download failed for ${row.storage_path}: ${res.status}`)
      }

      const buffer  = await res.arrayBuffer()
      const uint8   = new Uint8Array(buffer)
      const base64  = btoa(
        uint8.reduce((acc, byte) => acc + String.fromCharCode(byte), ''),
      )

      const mimeType = guessMimeType(row.storage_path)
      return { id: row.id, base64, mimeType } satisfies ImageInput
    },
    DOWNLOAD_CONCURRENCY,
  )

  const successfulDownloads: ImageInput[] = []
  const downloadErrors: string[] = []

  downloadResults.forEach((res, idx) => {
    if (res instanceof Error) {
      downloadErrors.push(`${unclassified[idx].storage_path}: ${res.message}`)
    } else {
      successfulDownloads.push(res)
    }
  })

  if (successfulDownloads.length === 0) {
    throw new Error(`All ${unclassified.length} image downloads failed: ${downloadErrors.join('; ')}`)
  }

  console.log(
    `[classify-images] Downloaded ${successfulDownloads.length}/${unclassified.length} images`,
  )

  // ── Single OpenAI batch call ─────────────────────────────────────────────
  const result = await classifyImages(successfulDownloads)

  console.log(
    `[classify-images] OpenAI returned ${result.classifications.length} results ` +
    `using ${result.usage.total_tokens} tokens (model: ${result.model})`,
  )

  // ── Persist classification results ───────────────────────────────────────
  const classificationMap = new Map(
    result.classifications.map((c) => [c.image_id, c]),
  )

  let classifiedCount = 0
  const persistErrors: string[] = []

  for (const img of successfulDownloads) {
    const classification = classificationMap.get(img.id)

    if (!classification) {
      persistErrors.push(`No classification returned for image ${img.id}`)
      continue
    }

    const { error: updateError } = await db
      .from('property_media')
      .update({
        category:        classification.category,
        ai_description:  classification.description,
        ai_confidence:   classification.confidence,
      })
      .eq('id', img.id)

    if (updateError) {
      persistErrors.push(`Failed to update ${img.id}: ${updateError.message}`)
    } else {
      classifiedCount++
    }
  }

  // ── Update cover image ───────────────────────────────────────────────────
  if (result.cover_image_id) {
    // Clear existing cover flag on all images for this property, then set new one
    await db
      .from('property_media')
      .update({ is_cover: false })
      .eq('property_id', propertyId)
      .eq('media_type', 'image')

    const { error: coverError } = await db
      .from('property_media')
      .update({ is_cover: true })
      .eq('id', result.cover_image_id)

    if (coverError) {
      console.warn(`[classify-images] Failed to set cover: ${coverError.message}`)
    } else {
      console.log(`[classify-images] Cover image set: ${result.cover_image_id}`)
    }
  }

  const allErrors = [...downloadErrors, ...persistErrors]
  const failedCount = (unclassified.length - successfulDownloads.length) +
                      (successfulDownloads.length - classifiedCount)

  return {
    totalCount,
    classifiedCount,
    failedCount,
    skippedCount,
    model:  result.model,
    usage:  result.usage,
    errors: allErrors,
  }
}

// ── Bounded concurrency helper ────────────────────────────────────────────────

async function runBounded<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<(R | Error)[]> {
  const results: (R | Error)[] = new Array(items.length)
  let idx = 0

  async function worker() {
    while (idx < items.length) {
      const i = idx++
      try {
        results[i] = await fn(items[i])
      } catch (err) {
        results[i] = err instanceof Error ? err : new Error(String(err))
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker)
  await Promise.all(workers)
  return results
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function guessMimeType(storagePath: string): string {
  const ext = storagePath.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png',  webp: 'image/webp',
  }
  return map[ext ?? ''] ?? 'image/jpeg'
}
