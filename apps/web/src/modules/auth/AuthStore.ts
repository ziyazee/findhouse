import { create } from 'zustand'
import { authService } from './AuthService'
import type { AuthSession } from './auth.types'

interface AuthState {
  session: AuthSession | null
  setSession: (session: AuthSession | null) => void
}

/** Starts from the session saved on this device; `App` re-checks it with the server once on startup. */
export const useAuthStore = create<AuthState>((set) => ({
  session: authService.getStoredSession(),
  setSession: (session) => set({ session }),
}))
