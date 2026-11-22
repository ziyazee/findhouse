import type { AuthSession, LoginInput, RegisterInput, RegistrationStatus } from './auth.types'
import { AuthError, PASSWORD_MIN } from './auth.types'
import { normalizePhone } from './phone'
import { supabase } from '@/lib/supabase'

const SESSION_KEY = 'findhouse_broker_session'
/** Postgres "invalid input syntax" — a saved id that isn't a UUID can't belong to any broker. */
const INVALID_ID = '22P02'

const NETWORK_ERROR = 'Couldn’t reach FindHouse. Check your connection and try again.'
const GENERIC_ERROR = 'Something went wrong. Please try again.'
/** Shown when a number hasn't been added by FindHouse. */
export const NOT_INVITED = 'Your number is not applicable for onboarding.'
const REGISTRATION_STATUSES: readonly RegistrationStatus[] = ['invited', 'not_invited', 'not_active', 'already_registered']

export interface IAuthService {
  login(input: LoginInput): Promise<AuthSession>
  /** Whether FindHouse has added this number, and whether its broker has already registered. */
  checkRegistration(phone: string): Promise<RegistrationStatus>
  register(input: RegisterInput): Promise<AuthSession>
  logout(): Promise<void>
  /** The session saved on this device, without checking it. */
  getStoredSession(): AuthSession | null
  /**
   * Re-checks the saved session with the server. Returns null (and forgets it) when the broker
   * no longer exists or isn't active. Keeps it when the server can't be reached, so the app still opens offline.
   */
  revalidate(session: AuthSession): Promise<AuthSession | null>
}

/** Why a broker with this status can't use the workspace, or null if they can. */
export function brokerAccessError(status: string): string | null {
  if (status === 'ACTIVE') return null
  if (status === 'BLOCKED') return 'This account has been blocked. Contact support.'
  return 'This account is inactive.'
}

class PhoneAuthService implements IAuthService {
  async login({ phone, password }: LoginInput): Promise<AuthSession> {
    const { data, error } = await supabase.rpc('broker_sign_in', {
      login_phone: normalizePhone(phone),
      login_password: password,
    })

    if (error) throw new AuthError(NETWORK_ERROR)
    const row = data?.[0]
    if (!row) throw new AuthError(GENERIC_ERROR)

    switch (row.outcome) {
      case 'ok':
        break
      case 'no_account':
        throw new AuthError('This number isn’t registered with FindHouse.')
      case 'not_registered':
        throw new AuthError('You haven’t finished registering yet. Use the Register tab to set your name and password.')
      case 'wrong_password':
        throw new AuthError('Wrong password. Try again.')
      case 'not_active':
        throw new AuthError(brokerAccessError(row.status ?? '') ?? 'This account is inactive.')
      default:
        throw new AuthError(GENERIC_ERROR)
    }
    if (!row.id || !row.phone) throw new AuthError(GENERIC_ERROR)

    const session: AuthSession = {
      user: { id: row.id, phone: row.phone, name: row.name, role: 'broker' },
    }
    this.save(session)
    return session
  }

  async checkRegistration(phone: string): Promise<RegistrationStatus> {
    const { data, error } = await supabase.rpc('broker_register_check', { check_phone: normalizePhone(phone) })
    if (error) throw new AuthError(NETWORK_ERROR)
    return REGISTRATION_STATUSES.includes(data as RegistrationStatus) ? (data as RegistrationStatus) : 'not_invited'
  }

  /** Saves the broker's name and password (and the site name made from the name) and signs them in. */
  async register({ phone, name, password }: RegisterInput): Promise<AuthSession> {
    const { data, error } = await supabase.rpc('broker_register', {
      reg_phone: normalizePhone(phone),
      reg_name: name.trim(),
      reg_password: password,
    })

    if (error) throw new AuthError(NETWORK_ERROR)
    const row = data?.[0]
    if (!row) throw new AuthError(GENERIC_ERROR)

    switch (row.outcome) {
      case 'registered':
        break
      case 'not_invited':
        throw new AuthError(NOT_INVITED)
      case 'not_active':
        throw new AuthError(brokerAccessError(row.status ?? 'INACTIVE') ?? 'This account is inactive.')
      case 'already_registered':
        throw new AuthError('This number is already registered. Sign in instead.')
      case 'weak_password':
        throw new AuthError(`Choose a password of at least ${PASSWORD_MIN} characters.`)
      case 'invalid_name':
        throw new AuthError('Use a name of 3 to 32 letters or numbers. It becomes your public page address.')
      case 'name_reserved':
        throw new AuthError('That name is reserved for FindHouse. Try another.')
      case 'name_taken':
        throw new AuthError('Another broker already uses that name. Try another.')
      default:
        throw new AuthError(GENERIC_ERROR)
    }
    if (!row.id || !row.phone) throw new AuthError(GENERIC_ERROR)

    const session: AuthSession = {
      user: { id: row.id, phone: row.phone, name: row.name, role: 'broker' },
    }
    this.save(session)
    return session
  }

  async logout(): Promise<void> {
    localStorage.removeItem(SESSION_KEY)
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
    const { data, error } = await supabase
      .from('brokers')
      .select('id, phone, status')
      .eq('id', session.user.id)
      .maybeSingle()

    if (error && error.code !== INVALID_ID) return session
    if (!data || brokerAccessError(data.status)) {
      await this.logout()
      return null
    }
    if (data.phone === session.user.phone) return session

    const refreshed: AuthSession = { user: { ...session.user, phone: data.phone } }
    this.save(refreshed)
    return refreshed
  }

  private save(session: AuthSession) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }
}

export const authService: IAuthService = new PhoneAuthService()
