// What the WhatsApp number does with each message, and the "ready" message process-submission sends back.
// Pure: no database or network, so whatsapp-webhook and process-submission share it (and their dashboard bundles
// carry a copy of it; keep them in step). The webhook itself never replies.

export type Plan = 'trial' | 'paid'
export type Classification = 'GREETING' | 'DONE' | 'PROPERTY_INFO' | 'OTHER'
/**
 * The broker's submission: none open, one collecting messages, or one being built after "done". A submission being
 * built still takes messages until the reply with its link goes out (a photo can reach us after the "done" behind it).
 */
export type SessionState = 'none' | 'collecting' | 'processing'

export interface BrokerState {
  plan: Plan
  trialUsed: boolean
}

export interface Decision {
  /** Keep the message in the broker's submission, opening one if needed. */
  store: boolean
  /** Start building the listing now. Messages that arrive while it is built are added to it. */
  finalize: boolean
}

const ignore: Decision = { store: false, finalize: false }

export function decide(broker: BrokerState, kind: Classification, session: SessionState): Decision {
  // The listing being built takes every detail until its reply goes out; another "done" changes nothing.
  if (session === 'processing') return kind === 'PROPERTY_INFO' ? { store: true, finalize: false } : ignore
  // Trial: once the free listing has been sent, everything is ignored.
  if (broker.plan === 'trial' && broker.trialUsed) return ignore

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
