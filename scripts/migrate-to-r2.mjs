/**
 * One-time migration: copy all media from Supabase storage → Cloudflare R2
 * Run: node scripts/migrate-to-r2.mjs
 */

import { readFileSync } from 'node:fs'
import { createHmac, createHash } from 'node:crypto'

// ── Load .env.migrate ─────────────────────────────────────────────────────────

try {
  const raw = readFileSync(new URL('../.env.migrate', import.meta.url), 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
} catch { /* no file */ }

const SUPABASE_URL     = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_BUCKET  = 'property-media'
const R2_ACCOUNT_ID    = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY    = process.env.R2_ACCESS_KEY_ID
const R2_SECRET        = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET        = process.env.R2_BUCKET_NAME ?? 'findhouse-media'

for (const [k, v] of [['SUPABASE_URL', SUPABASE_URL], ['SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_KEY], ['R2_ACCOUNT_ID', R2_ACCOUNT_ID], ['R2_ACCESS_KEY_ID', R2_ACCESS_KEY], ['R2_SECRET_ACCESS_KEY', R2_SECRET]]) {
  if (!v) { console.error(`Missing env var: ${k}`); process.exit(1) }
}

// ── R2 Sig v4 helpers ─────────────────────────────────────────────────────────

function sha256hex(data) {
  return createHash('sha256').update(data).digest('hex')
}

function hmacSha256(key, data) {
  return createHmac('sha256', key).update(data).digest()
}

async function r2Put(key, body, contentType) {
  // Encode each path segment so characters like `=` in filenames don't break Sig v4
  const encodedKey = key.split('/').map(s => encodeURIComponent(s)).join('/')
  const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${encodedKey}`
  const pu = new URL(url)
  const now = new Date()
  const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8)
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const payloadHash = sha256hex(body)

  const sh = { 'content-type': contentType, host: pu.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate }
  const hkeys = Object.keys(sh).sort()
  const canonReq = ['PUT', pu.pathname, '', hkeys.map((k) => `${k}:${sh[k]}\n`).join(''), hkeys.join(';'), payloadHash].join('\n')
  const credScope = `${dateStamp}/auto/s3/aws4_request`
  const sts = ['AWS4-HMAC-SHA256', amzDate, credScope, sha256hex(canonReq)].join('\n')

  let sigKey = hmacSha256(Buffer.from('AWS4' + R2_SECRET), dateStamp)
  sigKey = hmacSha256(sigKey, 'auto')
  sigKey = hmacSha256(sigKey, 's3')
  sigKey = hmacSha256(sigKey, 'aws4_request')
  const sig = hmacSha256(sigKey, sts).toString('hex')

  const auth = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${credScope}, SignedHeaders=${hkeys.join(';')}, Signature=${sig}`

  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...sh, authorization: auth },
    body,
    duplex: 'half',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`R2 upload failed (${res.status}): ${text.slice(0, 300)}`)
  }
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function supabaseQuery(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Supabase query failed (${res.status}): ${await res.text()}`)
  return res.json()
}

async function supabaseDownload(storagePath) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${storagePath}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  })
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

function guessMime(path) {
  const ext = path.split('.').pop()?.toLowerCase()
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', '3gp': 'video/3gpp', mov: 'video/quicktime' })[ext] ?? 'application/octet-stream'
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('Fetching storage paths from property_media...')
const propMedia = await supabaseQuery('property_media?select=storage_path')
const pathSet = new Set(propMedia.map(r => r.storage_path).filter(Boolean))

console.log('Fetching storage paths from whatsapp_submission_messages...')
const msgMedia = await supabaseQuery('whatsapp_submission_messages?select=media_storage_path&media_storage_path=not.is.null')
for (const r of msgMedia) if (r.media_storage_path) pathSet.add(r.media_storage_path)

const paths = [...pathSet]
console.log(`\nFound ${paths.length} unique files to migrate\n`)

if (paths.length === 0) { console.log('Nothing to migrate.'); process.exit(0) }

const retryOnly = process.argv.includes('--retry-failed')

let ok = 0, failed = 0, skipped = 0

for (let i = 0; i < paths.length; i++) {
  const path = paths[i]
  process.stdout.write(`[${i + 1}/${paths.length}] ${path} ... `)

  if (retryOnly) {
    // Skip files already in R2
    const encodedKey = path.split('/').map(s => encodeURIComponent(s)).join('/')
    const headUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${encodedKey}`
    const headRes = await fetch(headUrl, { method: 'HEAD' }).catch(() => null)
    if (headRes && headRes.ok) { console.log('already in R2, skipping'); skipped++; continue }
  }

  try {
    const bytes = await supabaseDownload(path)
    await r2Put(path, bytes, guessMime(path))
    console.log(`✓ (${(bytes.length / 1024).toFixed(1)} KB)`)
    ok++
  } catch (err) {
    console.log(`✗ ${err.message}`)
    failed++
  }
}

console.log(`\nDone: ${ok} migrated, ${skipped} skipped, ${failed} failed`)
