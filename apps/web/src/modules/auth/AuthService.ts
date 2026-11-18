import type { AuthSession, LoginInput } from './auth.types'
import { AuthError } from './auth.types'
import { supabase } from '@/lib/supabase'

const SESSION_KEY = 'findhouse_broker_session'

export interface IAuthService {
  login(input: LoginInput): Promise<AuthSession>
  logout(): Promise<void>
  getSession(): Promise<AuthSession | null>
}

class PhoneAuthService implements IAuthService {
  async login({ phone }: LoginInput): Promise<AuthSession> {
    const normalized = normalizePhone(phone)

    const { data, error } = await supabase
      .from('brokers')
      .select('id, phone, status')
      .eq('phone', normalized)
      .single()

    if (error || !data) throw new AuthError('No broker account found for this phone number.')
    if (data.status === 'BLOCKED') throw new AuthError('This account has been blocked. Contact support.')
    if (data.status === 'INACTIVE') throw new AuthError('This account is inactive.')

    const session: AuthSession = {
      user: {
        id: data.id,
        phone: data.phone,
        name: null,
        role: 'broker',
      },
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  }

  async logout(): Promise<void> {
    localStorage.removeItem(SESSION_KEY)
  }

  async getSession(): Promise<AuthSession | null> {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return null
      return JSON.parse(raw) as AuthSession
    } catch {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
  }
}

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length === 12) return digits
  if (digits.length === 10) return `91${digits}`
  return digits
}

export function createAuthService(): IAuthService {
  return new PhoneAuthService()
}
