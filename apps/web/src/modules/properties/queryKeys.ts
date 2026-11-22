/** React Query keys for property data. Everything lives under `all`, so one invalidation refreshes lists, details and pages. */
export const propertyKeys = {
  all: ['properties'] as const,
  lists: ['properties', 'list'] as const,
  list: (brokerId: string) => [...propertyKeys.lists, brokerId] as const,
  detail: (id: string) => [...propertyKeys.all, 'detail', id] as const,
  /** Public page, looked up by slug or (older links) by id. */
  publicPage: (ref: string) => [...propertyKeys.all, 'public', ref] as const,
  contact: (id: string) => [...propertyKeys.all, 'contact', id] as const,
  agentName: (id: string) => [...propertyKeys.all, 'agentName', id] as const,
  /** A broker's public page: their public listings. */
  /** A broker's whole public page (profile and listings) in one request. */
  brokerSite: (ref: string) => [...propertyKeys.all, 'brokerSite', ref] as const,
  brokerListings: (brokerId: string) => [...propertyKeys.all, 'broker', brokerId] as const,
  brokerProfile: (brokerId: string) => [...propertyKeys.all, 'brokerProfile', brokerId] as const,
}
