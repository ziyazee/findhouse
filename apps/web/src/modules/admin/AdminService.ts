/** Talks to /api/admin/brokers (a Pages Function). Every call carries the admin secret, which is only kept for the tab. */

const SECRET_KEY = 'findhouse_admin_secret'
const URL = '/api/admin/brokers'

export interface AdminBroker {
  id: string
  phone: string
  name: string | null
  subdomain: string | null
  status: string
  plan: string
  createdAt: string
  registered: boolean
}

export class AdminError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'AdminError'
  }
}

export const adminSecret = {
  get: () => sessionStorage.getItem(SECRET_KEY),
  set: (secret: string) => sessionStorage.setItem(SECRET_KEY, secret),
  clear: () => sessionStorage.removeItem(SECRET_KEY),
}

async function call<T>(init: RequestInit = {}, query = ''): Promise<T> {
  const secret = adminSecret.get()
  let res: Response
  try {
    res = await fetch(`${URL}${query}`, {
      ...init,
      headers: { ...init.headers, 'Content-Type': 'application/json', Authorization: `Bearer ${secret ?? ''}` },
    })
  } catch {
    throw new AdminError('Couldn’t reach FindHouse. Check your connection.', 0)
  }
  const body = (await res.json().catch(() => null)) as ({ error?: string } & T) | null
  if (!res.ok) throw new AdminError(body?.error ?? 'Something went wrong.', res.status)
  return body as T
}

export const adminService = {
  list: async () => (await call<{ brokers: AdminBroker[] }>()).brokers,
  add: (phone: string) => call<{ phone: string }>({ method: 'POST', body: JSON.stringify({ phone }) }),
  setStatus: (id: string, status: string) => call<{ ok: true }>({ method: 'PATCH', body: JSON.stringify({ id, status }) }),
  remove: (id: string) => call<{ ok: true }>({ method: 'DELETE' }, `?id=${encodeURIComponent(id)}`),
}
