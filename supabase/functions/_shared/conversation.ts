// What the WhatsApp number does with each message, and the "ready" message process-submission sends back.
// Pure: no database or network, so whatsapp-webhook and process-submission share it (and their dashboard bundles
// carry a copy of it; keep them in step). The webhook itself never replies.

export type Plan = 'trial' | 'paid'
export type Classification = 'GREETING' | 'DONE' | 'PROPERTY_INFO' | 'OTHER'
/** The broker's submission: none open, one collecting messages, or one being built after "done". */
export type SessionState = 'none' | 'collecting' | 'processing'

export interface BrokerState {
  plan: Plan
  trialUsed: boolean
}

export interface Decision {
  /** Keep the message in the broker's submission, opening one if needed. */
  store: boolean
  /**
   * Build the listing. The webhook first waits for the messages sent just before "done" to be saved
   * (they can arrive after it), then closes the submission.
   */
  finalize: boolean
}

const ignore: Decision = { store: false, finalize: false }

export function decide(broker: BrokerState, kind: Classification, session: SessionState): Decision {
  // Trial: anything while the free listing is built, and anything after it, is ignored.
  if (broker.plan === 'trial' && (broker.trialUsed || session === 'processing')) return ignore

  if (kind === 'PROPERTY_INFO') return { store: true, finalize: false }
  if (kind === 'DONE') return { store: true, finalize: true }
  return ignore
}

/** A listing's name as it appears in its link: "2 BHK in Andheri!" → "2-bhk-in-andheri". Decoration only. */
function nameSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '')
}

/**
 * <broker>.<SITE_DOMAIN>/<shortId>/<name> when subdomains are on (SITE_DOMAIN) and the broker has one; otherwise the
 * same path on the main site. Keep in step with listingPath in apps/web/src/lib/siteUrls.ts.
 */
export function listingUrl(listing: { shortId: string; title: string }, appUrl: string, siteDomain: string | undefined, subdomain: string | null | undefined): string {
  const name = nameSlug(listing.title)
  const path = name ? `/${listing.shortId}/${name}` : `/${listing.shortId}`
  if (siteDomain && subdomain) return `https://${subdomain}.${siteDomain}${path}`
  return `${appUrl.replace(/\/+$/, '')}${path}`
}
