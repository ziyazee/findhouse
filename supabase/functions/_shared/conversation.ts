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

/** On the broker's subdomain when subdomains are on (SITE_DOMAIN) and they have one; otherwise the main site. */
export function listingUrl(slug: string, appUrl: string, siteDomain: string | undefined, subdomain: string | null | undefined): string {
  if (siteDomain && subdomain) return `https://${subdomain}.${siteDomain}/p/${slug}`
  return `${appUrl.replace(/\/+$/, '')}/p/${slug}`
}
