/**
 * Brokers' public sites live on subdomains of `VITE_SITE_DOMAIN`: ravi-homes.findhouse.in is a broker's page and
 * ravi-homes.findhouse.in/<shortId>/<name> one of their listings. The main domain keeps the workspace and the older
 * /b/:id and /p/:slug links. With no domain configured, every link stays on the current site.
 */

/** Names that belong to FindHouse itself. Keep in step with is_reserved_subdomain() in migration 012. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  'www', 'app', 'api', 'admin', 'dashboard', 'login', 'auth', 'mail', 'email', 'smtp', 'ftp', 'cdn', 'static',
  'assets', 'media', 'img', 'images', 'files', 'help', 'support', 'docs', 'blog', 'status', 'dev', 'staging',
  'test', 'demo', 'beta', 'findhouse', 'broker', 'brokers', 'agent', 'agents', 'about', 'contact', 'terms',
  'privacy', 'legal', 'billing', 'pay', 'payments', 'account', 'settings', 'webhook', 'webhooks', 'whatsapp',
])

export const SUBDOMAIN_MIN = 3
export const SUBDOMAIN_MAX = 32

/** What the broker typed, tidied the way it will be saved: lowercase, spaces and underscores as hyphens. */
export function normalizeSubdomain(input: string): string {
  return input.trim().toLowerCase().replace(/[\s_]+/g, '-')
}

/** Why a subdomain can't be used, in words for the broker; null when it can. */
export function subdomainProblem(value: string): string | null {
  if (value.length < SUBDOMAIN_MIN) return `Use at least ${SUBDOMAIN_MIN} characters.`
  if (value.length > SUBDOMAIN_MAX) return `Use ${SUBDOMAIN_MAX} characters or fewer.`
  if (/[^a-z0-9-]/.test(value)) return 'Use only lowercase letters, numbers and hyphens.'
  if (value.startsWith('-') || value.endsWith('-')) return 'Start and end with a letter or a number.'
  if (value.includes('--')) return 'Don’t put two hyphens in a row.'
  if (RESERVED_SUBDOMAINS.has(value)) return 'That name is reserved for FindHouse. Try another.'
  return null
}

export interface SiteContext {
  protocol: string
  hostname: string
  port: string
  /** The configured site domain, e.g. "findhouse.in"; empty when subdomains are off. */
  domain: string
}

/** The broker subdomain a host belongs to: "ravi-homes.findhouse.in" → "ravi-homes"; null on the main site. */
export function subdomainOf(hostname: string, domain: string): string | null {
  if (!domain) return null
  const host = hostname.toLowerCase()
  if (!host.endsWith(`.${domain}`)) return null
  const label = host.slice(0, -(domain.length + 1))
  if (!label || label.includes('.') || label === 'www') return null
  return label
}

const withPort = (ctx: SiteContext, host: string) => `${ctx.protocol}//${host}${ctx.port ? `:${ctx.port}` : ''}`

/** Where the workspace and the /b/ and /p/ fallbacks live. */
export function mainOrigin(ctx: SiteContext): string {
  return subdomainOf(ctx.hostname, ctx.domain) ? withPort(ctx, ctx.domain) : withPort(ctx, ctx.hostname)
}

/** A broker's public page: their subdomain when they have one and subdomains are on, else /b/:id. */
export function brokerSiteUrl(ctx: SiteContext, broker: { id: string; subdomain: string | null }): string {
  if (ctx.domain && broker.subdomain) return `${withPort(ctx, `${broker.subdomain}.${ctx.domain}`)}/`
  return `${mainOrigin(ctx)}/b/${broker.id}`
}

/** A listing's name as it appears in its link: "2 BHK in Andheri!" → "2-bhk-in-andheri". Decoration only; the short id finds the listing. */
export function nameSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}

export interface ListingRef {
  shortId: string
  title: string
}

/** The path of a listing's page: /<shortId>/<name>. */
export function listingPath(listing: ListingRef): string {
  const name = nameSlug(listing.title)
  return name ? `/${listing.shortId}/${name}` : `/${listing.shortId}`
}

/** A listing's public page, on its broker's subdomain when known. */
export function listingSiteUrl(ctx: SiteContext, listing: ListingRef, subdomain: string | null): string {
  const origin = ctx.domain && subdomain ? withPort(ctx, `${subdomain}.${ctx.domain}`) : withPort(ctx, ctx.hostname)
  return `${origin}${listingPath(listing)}`
}
