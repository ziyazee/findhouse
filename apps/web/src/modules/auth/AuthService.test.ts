import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSession } from './auth.types'

const db = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
  filter: '',
  rpc: { data: null as unknown, error: null as unknown },
  rpcArgs: null as unknown,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async (_name: string, args: unknown) => {
      db.rpcArgs = args
      return db.rpc
    },
    from: () => ({
      select: () => ({
        eq: (col: string, value: string) => {
          db.filter = `${col}=${value}`
          return { maybeSingle: async () => db.result }
        },
      }),
    }),
  },
}))

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})

const { authService, brokerAccessError } = await import('./AuthService')

const saved: AuthSession = { user: { id: 'b1', phone: '919876543210', name: null, role: 'broker' } }

beforeEach(() => {
  store.clear()
  store.set('findhouse_broker_session', JSON.stringify(saved))
  db.result = { data: null, error: null }
})

describe('brokerAccessError', () => {
  it('lets only ACTIVE brokers in', () => {
    expect(brokerAccessError('ACTIVE')).toBeNull()
    expect(brokerAccessError('INACTIVE')).toMatch(/inactive/)
    expect(brokerAccessError('BLOCKED')).toMatch(/blocked/)
    expect(brokerAccessError('SOMETHING_NEW')).not.toBeNull()
  })
})

const signIn = (outcome: string, extra: Record<string, unknown> = {}) => ({
  data: [{ outcome, id: null, phone: null, status: null, name: null, ...extra }],
  error: null,
})
const broker = { id: 'b1', phone: '919876543210', status: 'ACTIVE', name: 'Ravi' }

describe('authService.login', () => {
  beforeEach(() => store.clear())

  it('sends the normalized phone and the password, and saves the session', async () => {
    db.rpc = signIn('ok', broker)
    const session = await authService.login({ phone: '+91 98765 43210', password: 'hunter2hunter2' })
    expect(db.rpcArgs).toEqual({ login_phone: '919876543210', login_password: 'hunter2hunter2' })
    expect(session.user).toEqual({ id: 'b1', phone: '919876543210', name: 'Ravi', role: 'broker' })
    expect(authService.getStoredSession()).toEqual(session)
  })

  it('signs in on first login, when the password is saved', async () => {
    db.rpc = signIn('password_set', broker)
    await expect(authService.login({ phone: '9876543210', password: 'brand-new-pass' })).resolves.toBeTruthy()
  })

  it.each([
    ['wrong_password', /wrong password/i],
    ['weak_password', /at least 8/],
    ['no_account', /no broker account/i],
  ])('refuses %s without saving a session', async (outcome, message) => {
    db.rpc = signIn(outcome)
    await expect(authService.login({ phone: '9876543210', password: 'x' })).rejects.toThrow(message)
    expect(authService.getStoredSession()).toBeNull()
  })

  it('refuses inactive or blocked brokers', async () => {
    db.rpc = signIn('not_active', { status: 'BLOCKED' })
    await expect(authService.login({ phone: '9876543210', password: 'whatever-pass' })).rejects.toThrow(/blocked/)
    expect(authService.getStoredSession()).toBeNull()
  })

  it('reports a connection problem instead of "no account"', async () => {
    db.rpc = { data: null, error: { message: 'fetch failed' } }
    await expect(authService.login({ phone: '9876543210', password: 'whatever-pass' })).rejects.toThrow(/reach FindHouse/)
  })
})

describe('authService.revalidate', () => {
  it('keeps an active broker signed in', async () => {
    db.result = { data: { id: 'b1', phone: '919876543210', status: 'ACTIVE' }, error: null }
    await expect(authService.revalidate(saved)).resolves.toEqual(saved)
    expect(db.filter).toBe('id=b1')
  })

  it.each(['INACTIVE', 'BLOCKED'])('signs out a %s broker', async (status) => {
    db.result = { data: { id: 'b1', phone: '919876543210', status }, error: null }
    await expect(authService.revalidate(saved)).resolves.toBeNull()
    expect(authService.getStoredSession()).toBeNull()
  })

  it('signs out a broker who no longer exists', async () => {
    await expect(authService.revalidate(saved)).resolves.toBeNull()
  })

  it('signs out a saved session whose id is not a UUID', async () => {
    db.result = { data: null, error: { code: '22P02', message: 'invalid input syntax for type uuid' } }
    await expect(authService.revalidate(saved)).resolves.toBeNull()
  })

  it('stays signed in when offline', async () => {
    db.result = { data: null, error: { message: 'fetch failed' } }
    await expect(authService.revalidate(saved)).resolves.toEqual(saved)
    expect(authService.getStoredSession()).toEqual(saved)
  })
})
