import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { brokerSiteUrl, currentSite, listingSiteUrl } from '@/lib/site'
import { useAuth } from '@/modules/auth/useAuth'
import { propertyKeys } from '@/modules/properties/queryKeys'
import type { Property } from '@/modules/properties/property.types'
import { brokerService, type BrokerProfile } from './BrokerService'

/**
 * The signed-in broker's public site: their subdomain, and links to their page and listings on it.
 * Until the subdomain is known (or when subdomains are off) links use the main site, so they always work.
 */
export function useMySite() {
  const { user } = useAuth()
  const profile = useQuery({
    queryKey: propertyKeys.brokerProfile(user?.id ?? ''),
    queryFn: () => brokerService.getProfile({ id: user!.id }),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  })
  const subdomain = profile.data?.subdomain ?? null
  const site = currentSite()
  return {
    profile,
    subdomain,
    pageUrl: user ? brokerSiteUrl(site, { id: user.id, subdomain }) : null,
    listingUrl: (p: Pick<Property, 'slug'>) => listingSiteUrl(site, p.slug, subdomain),
  }
}

export function useSetSubdomain() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (subdomain: string) => {
      if (!user) throw new Error('You’re signed out. Sign in again to change your site name.')
      return brokerService.setSubdomain(user.id, subdomain)
    },
    onSuccess: (subdomain) => {
      if (!user) return
      qc.setQueryData<BrokerProfile | null>(propertyKeys.brokerProfile(user.id), (old) => (old ? { ...old, subdomain } : old))
      void qc.invalidateQueries({ queryKey: propertyKeys.brokerProfile(user.id) })
    },
  })
}
