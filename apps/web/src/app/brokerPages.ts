export const brokerPages = {
  dashboard:   () => import('@/modules/dashboard/pages/DashboardPage'),
  properties:  () => import('@/modules/properties/pages/PropertiesPage'),
  property:    () => import('@/modules/properties/pages/PropertyPage'),
  newProperty: () => import('@/modules/properties/pages/NewPropertyPage'),
  enquiries:   () => import('@/modules/enquiries/pages/EnquiriesPage'),
  performance: () => import('@/modules/performance/pages/PerformancePage'),
  settings:    () => import('@/modules/account/pages/SettingsPage'),
  profile:     () => import('@/modules/account/pages/ProfilePage'),
  help:        () => import('@/modules/help/pages/HelpPage'),
}

/** Fetches every workspace page in the background so navigating never waits on a download. */
export function preloadBrokerPages() {
  for (const load of Object.values(brokerPages)) load().catch(() => {})
}
