export type UserRole = 'broker' | 'admin'

export interface AuthUser {
  id: string
  phone: string
  name: string | null
  role: UserRole
}

export interface AuthSession {
  user: AuthUser
}

export interface LoginInput {
  phone: string
  password: string
}

/** Shortest password a broker can choose. Keep in step with broker_sign_in in migration 016. */
export const PASSWORD_MIN = 8

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}
