import { env } from './env'
import { subdomainOf, type SiteContext } from './siteUrls'

export * from './siteUrls'

export function currentSite(): SiteContext {
  const { protocol, hostname, port } = window.location
  return { protocol, hostname, port, domain: env.siteDomain }
}

/** The broker subdomain this page was opened on, or null on the main site. */
export const siteSubdomain = subdomainOf(window.location.hostname, env.siteDomain)
