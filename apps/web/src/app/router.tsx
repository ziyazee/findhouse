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
const RegisterPage     = lazy(() => import('@/modules/auth/pages/RegisterPage'))
const PrivacyPage      = lazy(() => import('@/modules/legal/PrivacyPage'))
const AdminPage        = lazy(() => import('@/modules/admin/AdminPage'))
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
  // Current listing link: /<shortId>/<name>. A bare /<uuid> is an older link. Workspace routes like /properties/new are more specific and win.
  { path: '/:shortId/:name?', element: withSuspense(<PropertySitePage />) },

  // Guest only
  { path: '/login', element: guestLogin },
  { path: '/register', element: <GuestRoute>{withSuspense(<RegisterPage />)}</GuestRoute> },
  // Static path, so it is not treated as a listing short id.
  { path: '/privacy', element: withSuspense(<PrivacyPage />) },

  // FindHouse staff: adds the numbers brokers may register with. Has its own sign-in (an admin secret).
  { path: '/admin', element: withSuspense(<AdminPage />) },

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
  { path: '/:shortId/:name?', element: withSuspense(<PropertySitePage />) },
  { path: '*', element: <ToMainSite /> },
]

export const router = createBrowserRouter([
  { errorElement: <RouteError />, children: siteSubdomain ? brokerSiteRoutes : routes },
])
