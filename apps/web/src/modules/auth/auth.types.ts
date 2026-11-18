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
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}
