import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSession } from './auth.types'

const sb = vi.hoisted(() => ({
  signIn: { data: {}, error: null as unknown },
  signInArgs: null as unknown,
  signedOut: 0,
  authSession: { data: { session: { access_token: 't' } as unknown }, error: null as unknown },
  me: { data: null as unknown, error: null as unknown },
  check: { data: null as unknown, error: null as unknown },
  rpcCalls: [] as Array<[string, unknown]>,
}))

vi.mock('@supabase/supabase-js', () => ({
  isAuthRetryableFetchError: (e: { retryable?: boolean } | null) => Boolean(e?.retryable),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: async (args: unknown) => {
        sb.signInArgs = args
        return sb.signIn
      },
      signOut: async () => void (sb.signedOut += 1),
      getSession: async () => sb.authSession,
    },
    rpc: async (name: string, args: unknown) => {
      sb.rpcCalls.push([name, args])
      return name === 'broker_me' ? sb.me : sb.check
    },
  },
}))

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const { authService, brokerAccessError } = await import('./AuthService')

const saved: AuthSession = { user: { id: 'b1', phone: '919876543210', name: 'Ravi', role: 'broker' } }
const me = (status = 'ACTIVE') => ({ data: [{ id: 'b1', phone: '919876543210', name: 'Ravi', status, subdomain: 'ravi' }], error: null })
const badLogin = { code: 'invalid_credentials', message: 'Invalid login credentials' }

beforeEach(() => {
  store.clear()
  sb.signIn = { data: {}, error: null }
  sb.signedOut = 0
  sb.signInArgs = null
  sb.authSession = { data: { session: { access_token: 't' } }, error: null }
  sb.me = me()
  sb.check = { data: null, error: null }
  sb.rpcCalls = []
  fetchMock.mockReset()
})

describe('brokerAccessError', () => {
  it('lets only ACTIVE brokers in', () => {
    expect(brokerAccessError('ACTIVE')).toBeNull()
    expect(brokerAccessError('INACTIVE')).toMatch(/inactive/)
    expect(brokerAccessError('BLOCKED')).toMatch(/blocked/)
    expect(brokerAccessError('SOMETHING_NEW')).not.toBeNull()
  })
})

describe('authService.login', () => {
  it('signs in with the phone as the login name and saves the session', async () => {
    const session = await authService.login({ phone: '+91 98765 43210', password: 'hunter2hunter2' })
    expect(sb.signInArgs).toEqual({ email: '919876543210@brokers.findhouse.in', password: 'hunter2hunter2' })
    expect(session.user).toEqual({ id: 'b1', phone: '919876543210', name: 'Ravi', role: 'broker' })
    expect(authService.getStoredSession()).toEqual(session)
  })

  it.each([
    ['not_invited', /isn’t registered/],
    ['invited', /Register tab/],
    ['not_active', /inactive or blocked/],
    ['already_registered', /wrong password/i],
  ])('explains a failed sign-in for %s', async (status, message) => {
    sb.signIn = { data: {}, error: badLogin }
    sb.check = { data: status, error: null }
    await expect(authService.login({ phone: '9876543210', password: 'x' })).rejects.toThrow(message)
    expect(authService.getStoredSession()).toBeNull()
  })

  it('signs a blocked broker out again', async () => {
    sb.me = me('BLOCKED')
    await expect(authService.login({ phone: '9876543210', password: 'whatever-pass' })).rejects.toThrow(/blocked/)
    expect(sb.signedOut).toBe(1)
    expect(authService.getStoredSession()).toBeNull()
  })

  it('refuses a sign-in with no broker behind it', async () => {
    sb.me = { data: [], error: null }
    await expect(authService.login({ phone: '9876543210', password: 'whatever-pass' })).rejects.toThrow(/isn’t registered/)
    expect(sb.signedOut).toBe(1)
  })

  it('reports a connection problem instead of a wrong password', async () => {
    sb.signIn = { data: {}, error: { message: 'fetch failed', retryable: true } }
    await expect(authService.login({ phone: '9876543210', password: 'whatever-pass' })).rejects.toThrow(/reach FindHouse/)
  })
})

describe('authService.checkRegistration', () => {
  it('asks about the normalized number and passes the answer on', async () => {
    sb.check = { data: 'invited', error: null }
    await expect(authService.checkRegistration('+91 98765 43210')).resolves.toBe('invited')
    expect(sb.rpcCalls[0]).toEqual(['broker_register_check', { check_phone: '919876543210' }])
  })

  it('treats an unknown answer as not invited', async () => {
    sb.check = { data: 'something-new', error: null }
    await expect(authService.checkRegistration('9876543210')).resolves.toBe('not_invited')
  })

  it('reports a connection problem', async () => {
    sb.check = { data: null, error: { message: 'fetch failed' } }
    await expect(authService.checkRegistration('9876543210')).rejects.toThrow(/reach FindHouse/)
  })
})

describe('authService.register', () => {
  const input = { phone: '98765 43210', name: '  Rubbing ', password: 'long-enough-pass' }

  it('creates the account on the server, then signs in', async () => {
    fetchMock.mockResolvedValue({ ok: true })
    const session = await authService.register(input)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/register')
    expect(JSON.parse(init.body)).toEqual({ phone: '919876543210', name: 'Rubbing', password: 'long-enough-pass' })
    expect(sb.signInArgs).toEqual({ email: '919876543210@brokers.findhouse.in', password: 'long-enough-pass' })
    expect(session.user.id).toBe('b1')
  })

  it.each([
    ['not_invited', /not applicable for onboarding/],
    ['already_registered', /already registered/],
    ['weak_password', /at least 8/],
    ['invalid_name', /3 to 32/],
    ['name_reserved', /reserved/],
    ['name_taken', /already uses that name/],
  ])('refuses %s without signing in', async (code, message) => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ code }) })
    await expect(authService.register(input)).rejects.toThrow(message)
    expect(sb.signInArgs).toBeNull()
    expect(authService.getStoredSession()).toBeNull()
  })

  it('reports a connection problem', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    await expect(authService.register(input)).rejects.toThrow(/reach FindHouse/)
  })
})

describe('authService.revalidate', () => {
  beforeEach(() => store.set('findhouse_broker_session', JSON.stringify(saved)))

  it('keeps an active broker signed in', async () => {
    await expect(authService.revalidate(saved)).resolves.toEqual(saved)
  })

  it.each(['INACTIVE', 'BLOCKED'])('signs out a %s broker', async (status) => {
    sb.me = me(status)
    await expect(authService.revalidate(saved)).resolves.toBeNull()
    expect(authService.getStoredSession()).toBeNull()
    expect(sb.signedOut).toBe(1)
  })

  it('signs out when the Supabase sign-in is gone', async () => {
    sb.authSession = { data: { session: null }, error: null }
    await expect(authService.revalidate(saved)).resolves.toBeNull()
    expect(authService.getStoredSession()).toBeNull()
  })

  it('signs out a broker whose account was removed', async () => {
    sb.me = { data: [], error: null }
    await expect(authService.revalidate(saved)).resolves.toBeNull()
  })

  it('keeps the session when the token can’t be refreshed offline', async () => {
    sb.authSession = { data: { session: null }, error: { retryable: true } }
    await expect(authService.revalidate(saved)).resolves.toEqual(saved)
    expect(authService.getStoredSession()).toEqual(saved)
  })

  it('keeps the session when the server can’t be reached', async () => {
    sb.me = { data: null, error: { message: 'fetch failed' } }
    await expect(authService.revalidate(saved)).resolves.toEqual(saved)
    expect(authService.getStoredSession()).toEqual(saved)
  })

  it('updates the saved name when it changed', async () => {
    sb.me = { data: [{ id: 'b1', phone: '919876543210', name: 'Ravi Homes', status: 'ACTIVE', subdomain: 'ravi' }], error: null }
    const next = await authService.revalidate(saved)
    expect(next?.user.name).toBe('Ravi Homes')
    expect(authService.getStoredSession()).toEqual(next)
  })
})
