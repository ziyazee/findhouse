import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'
import { queryClient } from './lib/queryClient'
import { createAuthService } from './modules/auth/AuthService'
import { useAuthStore } from './modules/auth/AuthStore'
import { Toaster } from './shared/components/Toast'
import './index.css'

const authService = createAuthService()

function App() {
  const setSession = useAuthStore((s) => s.setSession)

  useEffect(() => {
    authService.getSession().then(setSession)
  }, [setSession])

  return (
    <>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
      <Toaster />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
