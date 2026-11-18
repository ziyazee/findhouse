import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractPropertyData } from '../_shared/aiExtractor.ts'
import {
  getSessionMessages,
  completeSession,
  failSession,
} from '../_shared/sessionManager.ts'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let sessionId: string
  try {
    const body = await req.json() as { sessionId?: string }
    if (!body.sessionId) throw new Error('sessionId is required')
    sessionId = body.sessionId
  } catch (err) {
    return new Response(String(err), { status: 400 })
  }

  console.log(`[process-submission] Starting for session: ${sessionId}`)

  // Fetch submission metadata
  const { data: session, error: sessionError } = await db
    .from('whatsapp_submissions')
    .select('id, broker_id, sender_phone, status')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return new Response('Submission not found', { status: 404 })
  }

  if (session.status !== 'PROCESSING') {
    console.warn(`[process-submission] Submission ${sessionId} is ${session.status}, skipping`)
    return new Response('Submission is not in PROCESSING state', { status: 409 })
  }

  try {
    // ── 1. Fetch all messages for this session ──────────────────────────────
    const messages = await getSessionMessages(db, sessionId)

    const propertyMessages = messages.filter(
      (m) => m.message_type !== 'text' || (m.content && m.content.trim()),
    )

    if (propertyMessages.length === 0) {
      await failSession(db, sessionId, 'No property information found in this submission.')
      return new Response('No property content', { status: 422 })
    }

    console.log(`[process-submission] Processing ${propertyMessages.length} messages`)

    // ── 2. AI extraction ────────────────────────────────────────────────────
    const extracted = await extractPropertyData(propertyMessages, Deno.env.get('SUPABASE_URL')!)
    console.log(`[process-submission] Extracted: ${extracted.title}`)

    // ── 3. Generate slug ────────────────────────────────────────────────────
    const slug = generateSlug(extracted.title)

    // ── 4. Create property record ───────────────────────────────────────────
    const { data: property, error: propertyError } = await db
      .from('properties')
      .insert({
        broker_id:   session.broker_id,
        session_id:  sessionId,
        slug,
        title: extracted.title,
        property_type: extracted.propertyType,
        listing_type: extracted.listingType,
        price: extracted.price,
        location: extracted.location,
        locality: extracted.locality,
        bedrooms: extracted.bedrooms,
        bathrooms: extracted.bathrooms,
        built_up_area: extracted.builtUpArea,
        carpet_area: extracted.carpetArea,
        furnishing: extracted.furnishing,
        floor: extracted.floor,
        total_floors: extracted.totalFloors,
        parking: extracted.parking,
        amenities: extracted.amenities,
        description: extracted.description,
        raw_data: extracted,
      })
      .select('id, slug')
      .single()

    if (propertyError) throw new Error(`Property insert failed: ${propertyError.message}`)

    console.log(`[process-submission] Property created: ${property.id} (${property.slug})`)

    // ── 5. Attach media from session messages ───────────────────────────────
    const mediaMessages = messages.filter(
      (m) => (m.message_type === 'image' || m.message_type === 'video') && m.storage_path,
    )

    if (mediaMessages.length > 0) {
      const mediaRows = mediaMessages.map((m, idx) => ({
        property_id: property.id,
        media_type: m.message_type,
        storage_path: m.storage_path,
        display_order: idx,
        is_cover: idx === 0,
      }))

      const { error: mediaError } = await db.from('property_media').insert(mediaRows)
      if (mediaError) {
        console.warn(`[process-submission] Media insert failed: ${mediaError.message}`)
        // Non-fatal — property still created
      }
    }

    // ── 6. Mark session COMPLETED ───────────────────────────────────────────
    await completeSession(db, sessionId, property.id)

    // ── 7. Send WhatsApp notification (fire-and-forget) ─────────────────────
    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
    const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        phoneNumber:   session.sender_phone,
        propertySlug:  property.slug,
        propertyTitle: extracted.title,
      }),
    }).catch((err) => console.error('[process-submission] Notification failed:', err))

    // ── 8. Classify property images (fire-and-forget) ────────────────────────
    fetch(`${supabaseUrl}/functions/v1/classify-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ propertyId: property.id }),
    }).catch((err) => console.error('[process-submission] Image classification failed:', err))

    return new Response(
      JSON.stringify({ ok: true, propertyId: property.id, slug: property.slug }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error(`[process-submission] Failed: ${reason}`)
    await failSession(db, sessionId, reason).catch(() => {})
    return new Response(JSON.stringify({ ok: false, error: reason }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}-${suffix}`
}
