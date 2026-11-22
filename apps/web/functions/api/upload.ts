interface Env {
  R2_BUCKET: R2Bucket
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
  VITE_SUPABASE_ANON_KEY?: string
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

/** The property a dashboard key belongs to: `properties/<id>/<file>` → `<id>`. */
export function propertyIdOf(key: string): string {
  return key.split('/')[1]
}

/**
 * Only a signed-in broker may touch a property's files, and only their own. The broker's token goes to the database
 * as-is, and `owns_property` answers from the row-level rules (an expired or forged token is refused there).
 * Returns the response to send when they may not, or null when they may.
 */
async function refuseUnlessOwner(request: Request, env: Env, key: string): Promise<Response | null> {
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return new Response('Sign in to upload', { status: 401 })
  const apikey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY
  if (!env.VITE_SUPABASE_URL || !apikey) return new Response('Uploads aren’t set up', { status: 503 })

  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/owns_property`, {
    method: 'POST',
    headers: { apikey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid: propertyIdOf(key) }),
  }).catch(() => null)
  if (!res) return new Response('Couldn’t check your account', { status: 502 })
  if (res.status === 401) return new Response('Sign in again to upload', { status: 401 })
  if (!res.ok || (await res.json().catch(() => false)) !== true) return new Response('This property isn’t yours', { status: 403 })
  return null
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
  const refused = await refuseUnlessOwner(context.request, context.env, key)
  if (refused) return refused

  await context.env.R2_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })
  return json({ key })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const key = new URL(context.request.url).searchParams.get('key')
  if (!isAllowedKey(key)) return new Response('Invalid key', { status: 400 })
  const refused = await refuseUnlessOwner(context.request, context.env, key)
  if (refused) return refused

  await context.env.R2_BUCKET.delete(key)
  return json({ deleted: key })
}
