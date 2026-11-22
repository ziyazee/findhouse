import type { AuthSession, LoginInput } from './auth.types'
import { AuthError, PASSWORD_MIN } from './auth.types'
import { normalizePhone } from './phone'
import { supabase } from '@/lib/supabase'

const SESSION_KEY = 'findhouse_broker_session'
/** Postgres "invalid input syntax" — a saved id that isn't a UUID can't belong to any broker. */
const INVALID_ID = '22P02'

export interface IAuthService {
  login(input: LoginInput): Promise<AuthSession>
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
  /**
   * Checks the password on the server. A broker with no password yet (first login) gets the one they typed saved
   * as their password, so this is also how an account is set up.
   */
  async login({ phone, password }: LoginInput): Promise<AuthSession> {
    const { data, error } = await supabase.rpc('broker_sign_in', {
      login_phone: normalizePhone(phone),
      login_password: password,
    })

    if (error) throw new AuthError('Couldn’t reach FindHouse. Check your connection and try again.')
    const row = data?.[0]
    if (!row) throw new AuthError('Couldn’t sign you in. Please try again.')

    switch (row.outcome) {
      case 'ok':
      case 'password_set':
        break
      case 'no_account':
        throw new AuthError('No broker account found for this phone number. Send a message to our WhatsApp number to create one.')
      case 'wrong_password':
        throw new AuthError('Wrong password. Try again.')
      case 'weak_password':
        throw new AuthError(`Choose a password of at least ${PASSWORD_MIN} characters.`)
      case 'not_active':
        throw new AuthError(brokerAccessError(row.status ?? '') ?? 'This account is inactive.')
      default:
        throw new AuthError('Couldn’t sign you in. Please try again.')
    }
    if (!row.id || !row.phone) throw new AuthError('Couldn’t sign you in. Please try again.')

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
