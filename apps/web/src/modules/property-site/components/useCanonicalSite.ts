import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { env } from '@/lib/env'
import { currentSite, listingPath, listingSiteUrl, mainOrigin, siteSubdomain } from '@/lib/site'
import { brokerService } from '@/modules/broker-site/BrokerService'
import { propertyKeys } from '@/modules/properties/queryKeys'
import type { Property } from '@/modules/properties/property.types'

/**
 * Keeps a listing on its broker's site. On a broker's subdomain, someone else's listing moves to the main site
 * (so a link survives the broker renaming their site). On the main site, once subdomains are on, a listing moves to
 * its broker's subdomain. Returns true while it's checking or about to move, so the page can wait.
 */
export function useCanonicalSite(property: Property | null | undefined): boolean {
  const ref = siteSubdomain
    ? { subdomain: siteSubdomain }
    : env.siteDomain && property?.brokerId ? { id: property.brokerId } : null
  const broker = useQuery({
    queryKey: propertyKeys.brokerProfile(siteSubdomain ? `@${siteSubdomain}` : property?.brokerId ?? ''),
    queryFn: () => brokerService.getProfile(ref!),
    enabled: Boolean(ref),
    staleTime: 5 * 60_000,
  })

  let target: string | null = null
  if (property && broker.isSuccess) {
    const site = currentSite()
    if (siteSubdomain) {
      if (broker.data?.id !== property.brokerId) target = `${mainOrigin(site)}${listingPath(property)}`
    } else if (broker.data?.subdomain) {
      target = listingSiteUrl(site, property, broker.data.subdomain)
    }
  }

  useEffect(() => {
    if (target) window.location.replace(target + window.location.search)
  }, [target])

  return Boolean(ref && broker.isLoading) || target != null
}
