import { isIndianMobile, normalizePhone } from '../../../src/modules/auth/phone'

// FindHouse staff manage the numbers brokers may register with. Brokers can't call this: every request needs the
// admin secret, and it talks to the database with the service key, which never reaches the browser.
//
// Pages environment variables (set as encrypted secrets, not in a local .env):
//   ADMIN_SECRET               what staff type on /admin
//   SUPABASE_SERVICE_ROLE_KEY  the project's service role key
//   VITE_SUPABASE_URL          already set for the app
//
//   GET     list brokers (and whether each has registered)
//   POST    { phone }          add a number
//   PATCH   { id, status }     ACTIVE, INACTIVE or BLOCKED
//   DELETE  ?id=…              remove a number that hasn't registered and has no listings

interface Env {
  ADMIN_SECRET?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  VITE_SUPABASE_URL?: string
}

export const STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED'] as const
export type BrokerStatus = (typeof STATUSES)[number]

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

/** `Authorization: Bearer <secret>` against the configured secret, in constant time. */
export async function isAuthorized(header: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret || !header?.startsWith('Bearer ')) return false
  const [given, wanted] = await Promise.all([sha256(header.slice(7)), sha256(secret)])
  let diff = 0
  for (let i = 0; i < wanted.length; i++) diff |= given[i] ^ wanted[i]
  return diff === 0
}

/** The number to add, as stored (919876543210), or null when it isn't a 10-digit Indian mobile. */
export function parseNewNumber(body: unknown): string | null {
  const phone = typeof (body as { phone?: unknown } | null)?.phone === 'string' ? (body as { phone: string }).phone : ''
  return isIndianMobile(phone) ? normalizePhone(phone) : null
}

export interface BrokerRow {
  id: string
  phone: string
  name: string | null
  subdomain: string | null
  status: string
  plan: string
  created_at: string
  broker_credentials: { broker_id: string } | { broker_id: string }[] | null
}

/** What the admin page shows for a broker. */
export function toAdminBroker(row: BrokerRow) {
  const creds = row.broker_credentials
  return {
    id: row.id,
    phone: row.phone,
    name: row.name?.trim() || null,
    subdomain: row.subdomain,
    status: row.status,
    plan: row.plan,
    createdAt: row.created_at,
    registered: Array.isArray(creds) ? creds.length > 0 : creds != null,
  }
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ADMIN_SECRET || !env.SUPABASE_SERVICE_ROLE_KEY || !env.VITE_SUPABASE_URL) {
    return json({ error: 'Admin isn’t set up yet. Set ADMIN_SECRET and SUPABASE_SERVICE_ROLE_KEY on the Pages project.' }, 503)
  }
  if (!(await isAuthorized(request.headers.get('Authorization'), env.ADMIN_SECRET))) {
    return json({ error: 'Wrong admin secret.' }, 401)
  }

  const rest = `${env.VITE_SUPABASE_URL}/rest/v1`
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
  const db = (path: string, init: RequestInit = {}) => fetch(`${rest}/${path}`, { ...init, headers: { ...headers, ...init.headers } })
  // Only reachable with the admin secret, so it's safe to say what the database answered.
  const failed = async (res?: Response) => {
    const detail = res ? await res.text().catch(() => '') : ''
    let reason = detail
    try { reason = (JSON.parse(detail) as { message?: string }).message ?? detail } catch { /* not JSON */ }
    console.error(`[admin] database request failed: ${res?.status ?? 'no response'} ${detail}`)
    return json({ error: `The database request failed${res ? ` (${res.status}${reason ? `: ${reason.slice(0, 200)}` : ''})` : ''}.` }, 500)
  }

  try {
    if (request.method === 'GET') {
      const res = await db('brokers?select=id,phone,name,subdomain,status,plan,created_at,broker_credentials(broker_id)&order=created_at.desc')
      if (!res.ok) return failed(res)
      return json({ brokers: ((await res.json()) as BrokerRow[]).map(toAdminBroker) })
    }

    if (request.method === 'POST') {
      const phone = parseNewNumber(await request.json().catch(() => null))
      if (!phone) return json({ error: 'Enter a valid 10-digit Indian mobile number.' }, 400)
      const res = await db('brokers', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ phone, status: 'ACTIVE' }) })
      if (res.status === 409) return json({ error: 'That number has already been added.' }, 409)
      if (!res.ok) return failed(res)
      return json({ phone }, 201)
    }

    if (request.method === 'PATCH') {
      const body = (await request.json().catch(() => null)) as { id?: unknown; status?: unknown } | null
      if (typeof body?.id !== 'string' || !STATUSES.includes(body.status as BrokerStatus)) return json({ error: 'Invalid request.' }, 400)
      const res = await db(`brokers?id=eq.${encodeURIComponent(body.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: body.status }) })
      if (!res.ok) return failed(res)
      return json({ ok: true })
    }

    if (request.method === 'DELETE') {
      const id = new URL(request.url).searchParams.get('id')
      if (!id) return json({ error: 'Invalid request.' }, 400)
      const found = await db(`brokers?select=id,broker_credentials(broker_id)&id=eq.${encodeURIComponent(id)}`)
      if (!found.ok) return failed(found)
      const [row] = (await found.json()) as Pick<BrokerRow, 'id' | 'broker_credentials'>[]
      if (!row) return json({ error: 'No such broker.' }, 404)
      if (toAdminBroker({ ...row, phone: '', name: null, subdomain: null, status: '', plan: '', created_at: '' }).registered) {
        return json({ error: 'This broker has registered. Block them instead of removing.' }, 409)
      }
      const res = await db(`brokers?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      if (!res.ok) return json({ error: 'This number has messages or listings, so it can’t be removed. Block it instead.' }, 409)
      return json({ ok: true })
    }

    return json({ error: 'Method not allowed.' }, 405)
  } catch (err) {
    console.error('[admin] request threw', err)
    return json({ error: `Couldn’t reach the database: ${err instanceof Error ? err.message : 'unknown error'}.` }, 500)
  }
}
