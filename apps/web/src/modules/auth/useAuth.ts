import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from './AuthStore'
import { authService } from './AuthService'
import type { LoginInput, RegisterInput } from './auth.types'

export function useAuth() {
  const session = useAuthStore((s) => s.session)
  const user = session?.user ?? null

  const login = useCallback(async (input: LoginInput) => {
    const newSession = await authService.login(input)
    useAuthStore.getState().setSession(newSession)
    return newSession
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const newSession = await authService.register(input)
    useAuthStore.getState().setSession(newSession)
    return newSession
  }, [])

  return { session, user, role: user?.role ?? null, isAuthenticated: session !== null, login, register }
}

/** Signs out, drops every cached query so the next broker starts clean, and goes to the login page. */
export function useSignOut() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useCallback(async () => {
    await authService.logout()
    useAuthStore.getState().setSession(null)
    queryClient.clear()
    navigate('/login')
  }, [navigate, queryClient])
}
