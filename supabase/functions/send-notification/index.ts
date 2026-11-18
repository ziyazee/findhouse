import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendWAMessage } from '../_shared/whatsappClient.ts'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let phoneNumber: string, propertySlug: string, propertyTitle: string
  try {
    const body = await req.json() as {
      phoneNumber?: string
      propertySlug?: string
      propertyTitle?: string
    }
    if (!body.phoneNumber || !body.propertySlug) {
      throw new Error('phoneNumber and propertySlug are required')
    }
    phoneNumber = body.phoneNumber
    propertySlug = body.propertySlug
    propertyTitle = body.propertyTitle ?? 'Your property'
  } catch (err) {
    return new Response(String(err), { status: 400 })
  }

  const appUrl = Deno.env.get('APP_URL') ?? 'https://findhouse.app'
  const propertyUrl = `${appUrl}/p/${propertySlug}`

  const message =
    `✅ *${propertyTitle}* listing is ready!\n\n` +
    `Your property page has been created. Share this link with your clients:\n\n` +
    `${propertyUrl}\n\n` +
    `_Powered by Find House_`

  console.log(`[send-notification] Sending to ${phoneNumber}: ${propertyUrl}`)

  try {
    await sendWAMessage(phoneNumber, message)
    console.log(`[send-notification] Sent successfully to ${phoneNumber}`)

    // Log notification in DB for auditability
    await db.from('submission_sessions').update({
      // We don't have a separate notifications table yet — future enhancement
    }).eq('whatsapp_number', phoneNumber).eq('status', 'COMPLETED')

    return new Response(
      JSON.stringify({ ok: true, url: propertyUrl }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error(`[send-notification] Failed: ${reason}`)
    // Not fatal — property was already created. Dashboard shows the URL.
    return new Response(
      JSON.stringify({ ok: false, error: reason, url: propertyUrl }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
