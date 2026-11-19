/**
 * One-time migration: copy all media from Supabase storage → Cloudflare R2
 *
 * Usage:
 *   deno run --allow-net --allow-env --allow-read scripts/migrate-to-r2.ts
 *
 * Reads credentials from .env.migrate (never committed).
 */

// ── Load .env.migrate ─────────────────────────────────────────────────────────

const envFile = await Deno.readTextFile(new URL('../.env.migrate', import.meta.url)).catch(() => '')
for (const line of envFile.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq < 1) continue
  const key = trimmed.slice(0, eq).trim()
  const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  if (!Deno.env.get(key)) Deno.env.set(key, val)
}

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_BUCKET   = 'property-media'

const R2_ACCOUNT_ID     = Deno.env.get('R2_ACCOUNT_ID')!
const R2_ACCESS_KEY     = Deno.env.get('R2_ACCESS_KEY_ID')!
const R2_SECRET         = Deno.env.get('R2_SECRET_ACCESS_KEY')!
const R2_BUCKET         = Deno.env.get('R2_BUCKET_NAME') ?? 'findhouse-media'

for (const [k, v] of [['SUPABASE_URL', SUPABASE_URL], ['SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_KEY], ['R2_ACCOUNT_ID', R2_ACCOUNT_ID], ['R2_ACCESS_KEY_ID', R2_ACCESS_KEY], ['R2_SECRET_ACCESS_KEY', R2_SECRET]]) {
  if (!v) { console.error(`Missing env var: ${k}`); Deno.exit(1) }
}

// ── R2 Sig v4 helpers ─────────────────────────────────────────────────────────

const enc = new TextEncoder()

async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, enc.encode(data))
}

async function sha256hex(data: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function r2Put(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`
  const pu = new URL(url)
  const now = new Date()
  const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8)
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const payloadHash = await sha256hex(body)
  const sh: Record<string, string> = { 'content-type': contentType, host: pu.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate }
  const hkeys = Object.keys(sh).sort()
  const canonReq = ['PUT', pu.pathname, '', hkeys.map((k) => `${k}:${sh[k]}\n`).join(''), hkeys.join(';'), payloadHash].join('\n')
  const credScope = `${dateStamp}/auto/s3/aws4_request`
  const sts = ['AWS4-HMAC-SHA256', amzDate, credScope, await sha256hex(enc.encode(canonReq))].join('\n')
  let sigKey = await hmac(enc.encode('AWS4' + R2_SECRET), dateStamp)
  sigKey = await hmac(sigKey, 'auto')
  sigKey = await hmac(sigKey, 's3')
  sigKey = await hmac(sigKey, 'aws4_request')
  const sig = hex(await hmac(sigKey, sts))
  const auth = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${credScope}, SignedHeaders=${hkeys.join(';')}, Signature=${sig}`
  const res = await fetch(url, { method: 'PUT', headers: { ...sh, authorization: auth }, body })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`R2 upload failed (${res.status}): ${text.slice(0, 300)}`)
  }
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function supabaseQuery(path: string): Promise<unknown[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Supabase query failed (${res.status}): ${await res.text()}`)
  return res.json()
}

async function supabaseDownload(storagePath: string): Promise<Uint8Array> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${storagePath}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase download failed (${res.status}) for ${storagePath}`)
  return new Uint8Array(await res.arrayBuffer())
}

function guessMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', '3gp': 'video/3gpp', mov: 'video/quicktime' } as Record<string, string>)[ext ?? ''] ?? 'application/octet-stream'
}

// ── Collect all storage paths ─────────────────────────────────────────────────

const pathSet = new Set<string>()

console.log('Fetching storage paths from property_media...')
const propMedia = await supabaseQuery('property_media?select=storage_path') as Array<{ storage_path: string }>
for (const r of propMedia) if (r.storage_path) pathSet.add(r.storage_path)

console.log('Fetching storage paths from whatsapp_submission_messages...')
const msgMedia = await supabaseQuery('whatsapp_submission_messages?select=media_storage_path&media_storage_path=not.is.null') as Array<{ media_storage_path: string }>
for (const r of msgMedia) if (r.media_storage_path) pathSet.add(r.media_storage_path)

const paths = [...pathSet]
console.log(`\nFound ${paths.length} unique files to migrate\n`)

if (paths.length === 0) {
  console.log('Nothing to migrate.')
  Deno.exit(0)
}

// ── Migrate ───────────────────────────────────────────────────────────────────

let ok = 0, failed = 0

for (let i = 0; i < paths.length; i++) {
  const path = paths[i]
  process.stdout.write(`[${i + 1}/${paths.length}] ${path} ... `)
  try {
    const bytes = await supabaseDownload(path)
    await r2Put(path, bytes, guessMime(path))
    console.log(`✓ (${(bytes.length / 1024).toFixed(1)} KB)`)
    ok++
  } catch (err) {
    console.log(`✗ ${err instanceof Error ? err.message : err}`)
    failed++
  }
}

console.log(`\nDone: ${ok} migrated, ${failed} failed`)
