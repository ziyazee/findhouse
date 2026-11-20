import type { AuthSession, LoginInput } from './auth.types'
import { AuthError } from './auth.types'
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
  async login({ phone }: LoginInput): Promise<AuthSession> {
    const { data, error } = await supabase
      .from('brokers')
      .select('id, phone, status')
      .eq('phone', normalizePhone(phone))
      .maybeSingle()

    if (error) throw new AuthError('Couldn’t reach FindHouse. Check your connection and try again.')
    if (!data) throw new AuthError('No broker account found for this phone number.')
    const denied = brokerAccessError(data.status)
    if (denied) throw new AuthError(denied)

    const session: AuthSession = {
      user: { id: data.id, phone: data.phone, name: null, role: 'broker' },
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
