/**
 * WhatsApp Business API client.
 * Handles media download and outbound message sending.
 */

const WA_API_BASE = 'https://graph.facebook.com/v19.0'

/** Downloads a media file from WhatsApp CDN and returns its bytes. */
export async function downloadWAMedia(mediaId: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  if (!accessToken) throw new Error('WHATSAPP_ACCESS_TOKEN is not set')

  // Step 1: get the download URL from the media ID
  const metaRes = await fetch(`${WA_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!metaRes.ok) {
    throw new Error(`Failed to fetch media metadata: ${metaRes.status}`)
  }

  const meta = await metaRes.json() as { url: string; mime_type: string }

  // Step 2: download the actual file
  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!fileRes.ok) {
    throw new Error(`Failed to download media file: ${fileRes.status}`)
  }

  const bytes = new Uint8Array(await fileRes.arrayBuffer())
  return { bytes, mimeType: meta.mime_type }
}

/** Sends a text message to a WhatsApp number. Links get a preview card unless `preview` is false. */
export async function sendWAMessage(toNumber: string, text: string, preview = true): Promise<void> {
  await sendWA(toNumber, { type: 'text', text: { body: text, preview_url: preview } })
}

async function sendWA(toNumber: string, message: Record<string, unknown>): Promise<void> {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

  if (!accessToken || !phoneNumberId) {
    throw new Error('WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not set')
  }

  const res = await fetch(`${WA_API_BASE}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toNumber,
      ...message,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to send WhatsApp message: ${res.status} — ${err}`)
  }
}

/** Verifies the X-Hub-Signature-256 header on an incoming webhook POST. */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')
  if (!appSecret) return false
  if (!signatureHeader?.startsWith('sha256=')) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return signatureHeader === `sha256=${hex}`
}

/** Returns the MIME-to-extension mapping for storage paths. */
export function mimeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'video/quicktime': 'mov',
  }
  return map[mimeType] ?? 'bin'
}
