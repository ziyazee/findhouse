import { create } from 'zustand'
import type { AuthSession } from './auth.types'

interface AuthState {
  session: AuthSession | null
  isLoading: boolean
  setSession: (session: AuthSession | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isLoading: true,
  setSession: (session) => set({ session, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}))
