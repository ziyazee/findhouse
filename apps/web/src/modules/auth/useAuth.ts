import { useCallback, useEffect } from 'react'
import { useAuthStore } from './AuthStore'
import { createAuthService } from './AuthService'
import type { LoginInput } from './auth.types'

const authService = createAuthService()

export function useAuth() {
  const { session, isLoading } = useAuthStore()

  useEffect(() => {
    authService.getSession().then((s) => {
      useAuthStore.getState().setSession(s)
    })
  }, [])

  const user = session?.user ?? null
  const role = session?.user.role ?? null
  const isAuthenticated = session !== null

  const login = useCallback(async (input: LoginInput) => {
    const newSession = await authService.login(input)
    useAuthStore.getState().setSession(newSession)
    return newSession
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    useAuthStore.getState().setSession(null)
  }, [])

  return { session, isLoading, user, role, isAuthenticated, login, logout }
}
