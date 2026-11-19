import { createBrowserRouter } from 'react-router-dom'
import { BrokerRoute, GuestRoute } from '@/modules/auth/guards'
import { AppShell } from '@/shared/components/AppShell/AppShell'
import { brokerPages } from './brokerPages'

import { lazy, Suspense } from 'react'

const LoginPage        = lazy(() => import('@/modules/auth/pages/LoginPage'))
const PropertySitePage = lazy(() => import('@/modules/property-site/PropertySitePage'))
const PipelineTestPage = lazy(() => import('@/modules/test-pipeline/pages/PipelineTestPage'))
const DashboardPage    = lazy(brokerPages.dashboard)
const PropertiesPage   = lazy(brokerPages.properties)
const PropertyPage     = lazy(brokerPages.property)
const NewPropertyPage  = lazy(brokerPages.newProperty)
const EnquiriesPage    = lazy(brokerPages.enquiries)
const PerformancePage  = lazy(brokerPages.performance)
const SettingsPage     = lazy(brokerPages.settings)
const ProfilePage      = lazy(brokerPages.profile)
const HelpPage         = lazy(brokerPages.help)

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
  {
    path: '/:order_id',
    element: withSuspense(<PropertySitePage />),
  },

  // Guest only
  {
    path: '/login',
    element: <GuestRoute>{withSuspense(<LoginPage />)}</GuestRoute>,
  },

  // Broker workspace: the shell stays mounted and only the page inside it changes
  {
    element: <BrokerRoute><AppShell /></BrokerRoute>,
    children: [
      { path: '/dashboard',      element: <DashboardPage /> },
      { path: '/properties',     element: <PropertiesPage /> },
      { path: '/properties/new', element: <NewPropertyPage /> },
      { path: '/properties/:id', element: <PropertyPage /> },
      { path: '/enquiries',      element: <EnquiriesPage /> },
      { path: '/performance',    element: <PerformancePage /> },
      { path: '/profile',        element: <ProfilePage /> },
      { path: '/settings',       element: <SettingsPage /> },
      { path: '/help',           element: <HelpPage /> },
    ],
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
