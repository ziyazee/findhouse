import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import type { AuthSession, LoginInput, RegisterInput, RegistrationStatus } from './auth.types'
import { AuthError, PASSWORD_MIN } from './auth.types'
import { brokerEmail, normalizePhone } from './phone'
import { supabase } from '@/lib/supabase'

const SESSION_KEY = 'findhouse_broker_session'

const NETWORK_ERROR = 'Couldn’t reach FindHouse. Check your connection and try again.'
const GENERIC_ERROR = 'Something went wrong. Please try again.'
/** Shown when a number hasn't been added by FindHouse. */
export const NOT_INVITED = 'Your number is not applicable for onboarding.'
const REGISTRATION_STATUSES: readonly RegistrationStatus[] = ['invited', 'not_invited', 'not_active', 'already_registered']

/** The register endpoint (functions/api/auth/register.ts). */
const REGISTER_API = '/api/auth/register'

export interface IAuthService {
  /** Signs in with Supabase Auth; every later request then carries the broker's own token. */
  login(input: LoginInput): Promise<AuthSession>
  /** Whether FindHouse has added this number, and whether its broker has already registered. */
  checkRegistration(phone: string): Promise<RegistrationStatus>
  /** Creates the broker's account (name, password) for a number FindHouse added, then signs them in. */
  register(input: RegisterInput): Promise<AuthSession>
  logout(): Promise<void>
  /** The session saved on this device, without checking it. */
  getStoredSession(): AuthSession | null
  /**
   * Re-checks the saved session: the Supabase sign-in must still be valid and the broker must still be active.
   * Returns null (and forgets it) otherwise. Keeps it when the server can't be reached, so the app still opens offline.
   */
  revalidate(session: AuthSession): Promise<AuthSession | null>
}

/** Why a broker with this status can't use the workspace, or null if they can. */
export function brokerAccessError(status: string): string | null {
  if (status === 'ACTIVE') return null
  if (status === 'BLOCKED') return 'This account has been blocked. Contact support.'
  return 'This account is inactive.'
}

/** What to tell someone who failed to register, by the code the register endpoint (or the database) answered with. */
function registerMessage(code: string | undefined): string {
  switch (code) {
    case 'not_invited': return NOT_INVITED
    case 'not_active': return 'This account is inactive or blocked. Contact support.'
    case 'already_registered': return 'This number is already registered. Sign in instead.'
    case 'weak_password': return `Choose a password of at least ${PASSWORD_MIN} characters.`
    case 'invalid_name': return 'Use a name of 3 to 32 letters or numbers. It becomes your public page address.'
    case 'name_reserved': return 'That name is reserved for FindHouse. Try another.'
    case 'name_taken': return 'Another broker already uses that name. Try another.'
    case 'invalid_phone': return 'Enter a valid 10-digit Indian mobile number.'
    default: return GENERIC_ERROR
  }
}

interface BrokerMe {
  id: string
  phone: string
  name: string | null
  status: string
}

/** Forgets the session saved on this device, without touching Supabase (safe inside its event callbacks). */
export function clearStoredSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

class SupabaseAuthService implements IAuthService {
  async login({ phone, password }: LoginInput): Promise<AuthSession> {
    const { error } = await supabase.auth.signInWithPassword({ email: brokerEmail(phone), password })

    if (error) {
      if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) {
        throw new AuthError(await this.whyNotSignedIn(phone))
      }
      throw new AuthError(isAuthRetryableFetchError(error) ? NETWORK_ERROR : GENERIC_ERROR)
    }

    const me = await this.fetchMe()
    if (!me) {
      await supabase.auth.signOut()
      throw new AuthError('This number isn’t registered with FindHouse.')
    }
    const denied = brokerAccessError(me.status)
    if (denied) {
      await supabase.auth.signOut()
      throw new AuthError(denied)
    }

    const session = toSession(me)
    this.save(session)
    return session
  }

  async checkRegistration(phone: string): Promise<RegistrationStatus> {
    const { data, error } = await supabase.rpc('broker_register_check', { check_phone: normalizePhone(phone) })
    if (error) throw new AuthError(NETWORK_ERROR)
    return REGISTRATION_STATUSES.includes(data as RegistrationStatus) ? (data as RegistrationStatus) : 'not_invited'
  }

  async register({ phone, name, password }: RegisterInput): Promise<AuthSession> {
    let res: Response
    try {
      res = await fetch(REGISTER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizePhone(phone), name: name.trim(), password }),
      })
    } catch {
      throw new AuthError(NETWORK_ERROR)
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { code?: string; detail?: string } | null
      const message = registerMessage(body?.code)
      throw new AuthError(body?.detail ? `${message} (${body.detail})` : message)
    }
    return this.login({ phone, password })
  }

  async logout(): Promise<void> {
    clearStoredSession()
    await supabase.auth.signOut().catch(() => undefined)
  }

  getStoredSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return null
      const session = JSON.parse(raw) as AuthSession
      return session?.user?.id ? session : null
    } catch {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
  }

  async revalidate(session: AuthSession): Promise<AuthSession | null> {
    const { data, error } = await supabase.auth.getSession()
    if (!data.session) {
      // Couldn't refresh the token because we're offline: keep going. Otherwise the sign-in is gone.
      if (error && isAuthRetryableFetchError(error)) return session
      await this.logout()
      return null
    }

    let me: BrokerMe | null
    try {
      me = await this.fetchMe()
    } catch {
      return session
    }
    if (!me || me.id !== session.user.id || brokerAccessError(me.status)) {
      await this.logout()
      return null
    }
    if (me.phone === session.user.phone && me.name === session.user.name) return session

    const refreshed = toSession(me)
    this.save(refreshed)
    return refreshed
  }

  /** The signed-in broker; null when this sign-in has no broker behind it. Throws when the server can't be reached. */
  private async fetchMe(): Promise<BrokerMe | null> {
    const { data, error } = await supabase.rpc('broker_me')
    if (error) throw new AuthError(NETWORK_ERROR)
    const row = data?.[0]
    return row ? { id: row.id, phone: row.phone, name: row.name, status: row.status } : null
  }

  /** Supabase only says "invalid credentials"; the registration check tells the broker what is actually wrong. */
  private async whyNotSignedIn(phone: string): Promise<string> {
    try {
      switch (await this.checkRegistration(phone)) {
        case 'not_invited': return 'This number isn’t registered with FindHouse.'
        case 'invited': return 'You haven’t finished registering yet. Use the Register tab to set your name and password.'
        case 'not_active': return 'This account is inactive or blocked. Contact support.'
        default: return 'Wrong password. Try again.'
      }
    } catch {
      return 'Wrong password. Try again.'
    }
  }

  private save(session: AuthSession) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }
}

const toSession = (me: BrokerMe): AuthSession => ({ user: { id: me.id, phone: me.phone, name: me.name, role: 'broker' } })

export const authService: IAuthService = new SupabaseAuthService()
