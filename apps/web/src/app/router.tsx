import { lazy, Suspense } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { siteSubdomain } from '@/lib/site'
import { BrokerRoute, GuestRoute } from '@/modules/auth/guards'
import { AppShell } from '@/shared/components/AppShell/AppShell'
import { PageSpinner } from '@/shared/components/PageSpinner'
import { brokerPages } from './brokerPages'
import { RouteError } from './RouteError'
import { ToMainSite } from './ToMainSite'

const LoginPage        = lazy(() => import('@/modules/auth/pages/LoginPage'))
const PropertySitePage = lazy(() => import('@/modules/property-site/PropertySitePage'))
const BrokerSitePage   = lazy(() => import('@/modules/broker-site/BrokerSitePage'))
const DashboardPage    = lazy(brokerPages.dashboard)
const PropertiesPage   = lazy(brokerPages.properties)
const PropertyPage     = lazy(brokerPages.property)
const NewPropertyPage  = lazy(brokerPages.newProperty)
const EnquiriesPage    = lazy(brokerPages.enquiries)
const PerformancePage  = lazy(brokerPages.performance)
const SettingsPage     = lazy(brokerPages.settings)
const ProfilePage      = lazy(brokerPages.profile)
const HelpPage         = lazy(brokerPages.help)

function withSuspense(el: JSX.Element) {
  return <Suspense fallback={<PageSpinner />}>{el}</Suspense>
}

const guestLogin = <GuestRoute>{withSuspense(<LoginPage />)}</GuestRoute>

const routes: RouteObject[] = [
  // Public property site
  { path: '/p/:slug', element: withSuspense(<PropertySitePage />) },
  { path: '/b/:brokerId', element: withSuspense(<BrokerSitePage />) },
  { path: '/:order_id', element: withSuspense(<PropertySitePage />) },

  // Guest only
  { path: '/login', element: guestLogin },

  // Broker workspace: the shell stays mounted and only the page inside it changes
  {
    element: <BrokerRoute><AppShell /></BrokerRoute>,
    children: [
      {
        errorElement: <RouteError inShell />,
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
    ],
  },

  // Internal pipeline inspector: reads every broker's submissions, so it is left out of production builds.
  ...(import.meta.env.DEV
    ? [{ path: '/test/pipeline', lazy: async () => ({ Component: (await import('@/modules/test-pipeline/pages/PipelineTestPage')).default }) }]
    : []),

  // Fallback
  { path: '/', element: guestLogin },
  { path: '*', element: guestLogin },
]

// A broker's own site (ravi-homes.findhouse.in): their page and their listings.
const brokerSiteRoutes: RouteObject[] = [
  { path: '/', element: withSuspense(<BrokerSitePage />) },
  { path: '/p/:slug', element: withSuspense(<PropertySitePage />) },
  { path: '*', element: <ToMainSite /> },
]

export const router = createBrowserRouter([
  { errorElement: <RouteError />, children: siteSubdomain ? brokerSiteRoutes : routes },
])
