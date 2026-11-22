/**
 * Browser-safe configuration. Everything here ships to the client, so it must only ever hold
 * public values (project URL, publishable key, public media host) — never service-role keys,
 * WhatsApp tokens or other server secrets.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill in your project values.`)
  }
  return value
}

/** The live product domain. On it (or any subdomain of it) broker subdomains are on even when VITE_SITE_DOMAIN isn't set. */
const PRODUCT_DOMAIN = 'findhouse.in'

function siteDomain(): string {
  const configured = (import.meta.env.VITE_SITE_DOMAIN ?? '').trim().toLowerCase().replace(/^\.+|\.+$/g, '')
  if (configured) return configured
  const host = typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase()
  return host === PRODUCT_DOMAIN || host.endsWith(`.${PRODUCT_DOMAIN}`) ? PRODUCT_DOMAIN : ''
}

export const env = {
  supabaseUrl: required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  supabaseKey: required(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY,
  ),
  /** Public base URL of the media bucket; objects are addressed as `${mediaBaseUrl}/${storagePath}`. */
  mediaBaseUrl: import.meta.env.VITE_R2_PUBLIC_URL ?? '',
  /** Domain whose subdomains are brokers' public sites, e.g. "findhouse.in"; empty keeps every link on this site. */
  siteDomain: siteDomain(),
} as const
