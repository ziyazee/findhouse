interface Env {
  R2_BUCKET: R2Bucket
}

/**
 * Dashboard uploads only: `properties/<property uuid>/<file name>`. Anything else — in particular
 * WhatsApp media under `submissions/`, which the original messages still point at — is refused.
 * Keep in step with `DASHBOARD_PREFIX` in src/lib/storage.ts.
 */
const KEY_PATTERN = /^properties\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]{1,128}$/i
const MAX_BYTES = 50 * 1024 * 1024

export function isAllowedKey(key: string | null): key is string {
  return !!key && KEY_PATTERN.test(key) && !key.includes('..')
}

export function isAllowedType(type: string): boolean {
  return type.startsWith('image/') || type.startsWith('video/')
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const formData = await context.request.formData()
  const file = formData.get('file')
  const key = formData.get('key')

  if (!(file instanceof File) || typeof key !== 'string') return new Response('Missing file or key', { status: 400 })
  if (!isAllowedKey(key)) return new Response('Invalid key', { status: 400 })
  if (!isAllowedType(file.type)) return new Response('Only photos and videos can be uploaded', { status: 415 })
  if (file.size > MAX_BYTES) return new Response('Files must be 50 MB or smaller', { status: 413 })

  await context.env.R2_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })
  return json({ key })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const key = new URL(context.request.url).searchParams.get('key')
  if (!isAllowedKey(key)) return new Response('Invalid key', { status: 400 })

  await context.env.R2_BUCKET.delete(key)
  return json({ deleted: key })
}
