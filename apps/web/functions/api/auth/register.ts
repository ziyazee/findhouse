import { brokerEmail, isIndianMobile, normalizePhone } from '../../../src/modules/auth/phone'
import { RESERVED_SUBDOMAINS, subdomainFromName, subdomainProblem } from '../../../src/lib/siteUrls'

// Creates a broker's login. Only for numbers FindHouse staff added in /admin; the name becomes their public site name.
// Uses the service key to create the Supabase Auth user (public sign-ups stay switched off), links it to the broker row
// and returns. The browser then signs in with the same number and password.
//
// Pages environment variables: SUPABASE_SERVICE_ROLE_KEY (encrypted) and VITE_SUPABASE_URL.

interface Env {
  SUPABASE_SERVICE_ROLE_KEY?: string
  VITE_SUPABASE_URL?: string
}

export const PASSWORD_MIN = 8
const NAME_MAX = 80

export interface Registration {
  phone: string
  name: string
  password: string
}

/** The request's contents, or the `code` to refuse it with (the browser turns codes into sentences). */
export function parseRegistration(body: unknown): Registration | { code: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const phone = typeof b.phone === 'string' ? b.phone : ''
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  const password = typeof b.password === 'string' ? b.password : ''

  if (!isIndianMobile(phone)) return { code: 'invalid_phone' }
  if (password.length < PASSWORD_MIN || password.length > 200) return { code: 'weak_password' }
  const site = subdomainFromName(name)
  if (RESERVED_SUBDOMAINS.has(site)) return { code: 'name_reserved' }
  if (!name || name.length > NAME_MAX || subdomainProblem(site)) return { code: 'invalid_name' }
  return { phone: normalizePhone(phone), name, password }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

const REFUSALS: Record<string, number> = {
  not_invited: 403, not_active: 403, already_registered: 409, name_taken: 409,
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.VITE_SUPABASE_URL) return json({ code: 'unavailable' }, 503)

  const parsed = parseRegistration(await request.json().catch(() => null))
  if ('code' in parsed) return json(parsed, 400)

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
  const call = (path: string, init: RequestInit) => fetch(`${env.VITE_SUPABASE_URL}${path}`, { ...init, headers })
  const rpc = (name: string, args: unknown) => call(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) })

  try {
    // 1. Only numbers FindHouse added, and not twice.
    const check = await rpc('broker_register_check', { check_phone: parsed.phone })
    if (!check.ok) return json({ code: 'unavailable' }, 500)
    const status = (await check.json()) as string
    if (status !== 'invited') return json({ code: status }, REFUSALS[status] ?? 403)

    // 2. The login: the number as the name, the password they chose, no confirmation email.
    const created = await call('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email: brokerEmail(parsed.phone), password: parsed.password, email_confirm: true }),
    })
    if (!created.ok) {
      const err = (await created.json().catch(() => ({}))) as { error_code?: string }
      return err.error_code === 'email_exists' ? json({ code: 'already_registered' }, 409) : json({ code: 'unavailable' }, 500)
    }
    const user = (await created.json()) as { id: string }

    // 3. Attach it to the broker and save the name and site name. If that is refused, undo the login.
    const link = await rpc('broker_link_auth_user', { reg_phone: parsed.phone, reg_user_id: user.id, reg_name: parsed.name })
    const outcome = link.ok ? ((await link.json()) as string) : 'unavailable'
    if (outcome !== 'registered') {
      await call(`/auth/v1/admin/users/${user.id}`, { method: 'DELETE' })
      return json({ code: outcome }, REFUSALS[outcome] ?? (outcome === 'unavailable' ? 500 : 400))
    }
    return json({ ok: true, subdomain: subdomainFromName(parsed.name) }, 201)
  } catch (err) {
    console.error('[register] failed', err)
    return json({ code: 'unavailable' }, 500)
  }
}
