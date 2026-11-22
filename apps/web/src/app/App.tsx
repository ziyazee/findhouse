import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { authService, clearStoredSession } from '@/modules/auth/AuthService'
import { useAuthStore } from '@/modules/auth/AuthStore'
import { Toaster } from '@/shared/components/Toast'
import { toast } from '@/shared/components/toastStore'
import { queryClient } from './queryClient'
import { router } from './router'

/** Signs the broker out if their account was removed, blocked or made inactive since they last signed in. */
function useRevalidateSession() {
  useEffect(() => {
    const saved = useAuthStore.getState().session
    if (!saved) return
    authService.revalidate(saved).then((next) => {
      // Ignore the answer if they signed out or in as someone else while it was on its way.
      if (useAuthStore.getState().session?.user.id !== saved.user.id) return
      if (!next) {
        queryClient.clear()
        toast.error('You’ve been signed out because this account is no longer active.')
      }
      useAuthStore.getState().setSession(next)
    })
  }, [])
}

/** If Supabase ends the sign-in (token can't be refreshed, signed out in another tab), the workspace follows. */
function useFollowSupabaseSignOut() {
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT' || !useAuthStore.getState().session) return
      clearStoredSession()
      queryClient.clear()
      useAuthStore.getState().setSession(null)
    })
    return () => data.subscription.unsubscribe()
  }, [])
}

export function App() {
  useRevalidateSession()
  useFollowSupabaseSignOut()
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
      <Toaster />
    </QueryClientProvider>
  )
}
