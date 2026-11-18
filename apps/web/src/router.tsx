import { createBrowserRouter } from 'react-router-dom'
import { BrokerRoute, GuestRoute } from '@/modules/auth/guards'

import { lazy, Suspense } from 'react'

const LoginPage        = lazy(() => import('@/modules/auth/pages/LoginPage'))
const DashboardPage    = lazy(() => import('@/modules/dashboard/pages/DashboardPage'))
const PropertiesPage   = lazy(() => import('@/modules/properties/pages/PropertiesPage'))
const PropertyPage     = lazy(() => import('@/modules/properties/pages/PropertyPage'))
const NewPropertyPage  = lazy(() => import('@/modules/properties/pages/NewPropertyPage'))
const PropertySitePage = lazy(() => import('@/modules/property-site/PropertySitePage'))
const PipelineTestPage = lazy(() => import('@/modules/test-pipeline/pages/PipelineTestPage'))

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  )
}

function withSuspense(el: JSX.Element) {
  return <Suspense fallback={<Loader />}>{el}</Suspense>
}

export const router = createBrowserRouter([
  // Public property site
  {
    path: '/p/:slug',
    element: withSuspense(<PropertySitePage />),
  },

  // Guest only
  {
    path: '/login',
    element: <GuestRoute>{withSuspense(<LoginPage />)}</GuestRoute>,
  },

  // Broker workspace
  {
    path: '/dashboard',
    element: <BrokerRoute>{withSuspense(<DashboardPage />)}</BrokerRoute>,
  },
  {
    path: '/properties',
    element: <BrokerRoute>{withSuspense(<PropertiesPage />)}</BrokerRoute>,
  },
  {
    path: '/properties/new',
    element: <BrokerRoute>{withSuspense(<NewPropertyPage />)}</BrokerRoute>,
  },
  {
    path: '/properties/:id',
    element: <BrokerRoute>{withSuspense(<PropertyPage />)}</BrokerRoute>,
  },

  // Dev / testing
  {
    path: '/test/pipeline',
    element: withSuspense(<PipelineTestPage />),
  },

  // Fallback
  {
    path: '/',
    element: <GuestRoute>{withSuspense(<LoginPage />)}</GuestRoute>,
  },
  {
    path: '*',
    element: withSuspense(<LoginPage />),
  },
])
