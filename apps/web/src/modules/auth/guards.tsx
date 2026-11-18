import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'

export function BrokerRoute({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth()
  if (isLoading) return <PageSpinner />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth()
  if (isLoading) return <PageSpinner />
  if (session) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function PageSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  )
}
