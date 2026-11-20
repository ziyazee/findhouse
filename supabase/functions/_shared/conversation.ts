// What the WhatsApp number does with each message, and what it says back.
// Pure: no database or network, so whatsapp-webhook and process-submission share it (and their dashboard bundles
// carry a copy of it; keep them in step).

export type Plan = 'trial' | 'paid'
export type Classification = 'GREETING' | 'DONE' | 'PROPERTY_INFO' | 'OTHER'
/** The broker's submission: none open, one collecting messages, or one being built after "done". */
export type SessionState = 'none' | 'collecting' | 'processing'
export type ReplyKind = 'welcome' | 'start_hint' | 'paid_hint' | 'keep_going' | 'building' | 'trial_over'

export interface BrokerState {
  plan: Plan
  welcomed: boolean
  trialUsed: boolean
}

export interface Decision {
  /** Keep the message in the broker's submission, opening one if needed. */
  store: boolean
  /** Close the submission and build the listing. */
  finalize: boolean
  reply: ReplyKind | null
}

/** Replies other than `building` wait this long, and go out only if no newer message arrived meanwhile. */
export const REPLY_DELAY_MS = 3000
/** "Trial is over" replies stop after this many. */
export const TRIAL_OVER_LIMIT = 5

const nothing: Decision = { store: false, finalize: false, reply: null }

export function decide(broker: BrokerState, kind: Classification, session: SessionState): Decision {
  if (broker.plan === 'paid') {
    if (kind === 'GREETING') return { ...nothing, reply: session === 'collecting' ? 'keep_going' : 'paid_hint' }
    if (kind === 'PROPERTY_INFO') return { ...nothing, store: true }
    if (kind === 'DONE' && session === 'collecting') return { ...nothing, store: true, finalize: true }
    return nothing
  }

  // Trial: one free listing, then only the plans.
  if (broker.trialUsed) return { ...nothing, reply: 'trial_over' }
  if (session === 'processing') return nothing
  // Whatever a new number sends first is answered with the welcome and not kept.
  if (!broker.welcomed) return { ...nothing, reply: 'welcome' }

  if (session === 'collecting') {
    if (kind === 'GREETING') return { ...nothing, reply: 'keep_going' }
    if (kind === 'PROPERTY_INFO') return { ...nothing, store: true }
    if (kind === 'DONE') return { store: true, finalize: true, reply: 'building' }
    return nothing
  }

  if (kind === 'PROPERTY_INFO') return { ...nothing, store: true }
  if (kind === 'GREETING' || kind === 'DONE') return { ...nothing, reply: 'start_hint' }
  return nothing
}

/** "https://findhouse.in/" → "findhouse.in", for showing in a message. */
export function displayHost(appUrl: string): string {
  return appUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

export function replyText(kind: ReplyKind, appUrl: string): string {
  const site = displayHost(appUrl)
  switch (kind) {
    case 'welcome':
      return [
        'Hi 👋 Welcome to *FindHouse*!',
        '',
        'We turn your WhatsApp messages into a beautiful website for each property, ready to share with your clients.',
        '',
        '*How it works*',
        '1. Send photos, videos and details of a property here',
        '2. Send *done* when you’ve sent everything',
        '3. Get your property’s website link in about 30 seconds',
        '',
        `*Your dashboard*\nSign in at ${site} with this number to edit details and photos, track how your properties perform, and get your own page with all your listings.`,
        '',
        '*Let’s try one listing for you* 🏠',
        'Send the photos and details of *one property*: rent or price, location, rooms, size and anything else a client should know.',
        'When everything is sent, send *done* and we’ll build it for you.',
      ].join('\n')
    case 'start_hint':
      return 'Send the photos and details of *one property* here. When everything is sent, send *done* and we’ll build its website in about 30 seconds.'
    case 'paid_hint':
      return 'Hi 👋 Send the photos and details of a property here, then send *done* and we’ll build its website.'
    case 'keep_going':
      return 'Got it 👍 Keep sending photos and details. When everything is sent, send *done*.'
    case 'building':
      return 'Great! 🙌 Let’s build your website. I’ll be back in a few seconds with your link.'
    case 'trial_over':
      return [
        'Your free trial is over. We hope you liked your property website! 🏠',
        '',
        'To keep listing properties with FindHouse, choose a plan:',
        '• *Monthly:* ₹499 a month',
        '• *Yearly:* ₹4,999 a year (2 months free)',
      ].join('\n')
  }
}

export function readyText(title: string, listingUrl: string, appUrl: string): string {
  return [
    'Your property website is ready! 🎉',
    '',
    `*${title}*`,
    listingUrl,
    '',
    `Share this link with your clients. To edit details or photos, sign in at ${displayHost(appUrl)} with this number.`,
  ].join('\n')
}

export function failedText(): string {
  return 'Sorry, we couldn’t build that listing. Please send the photos and details again, then send *done*. This doesn’t use up your free listing.'
}

/** The listing's public page: on the broker's subdomain when subdomains are on and they have one. */
export function listingUrl(slug: string, appUrl: string, siteDomain: string | undefined, subdomain: string | null | undefined): string {
  if (siteDomain && subdomain) return `https://${subdomain}.${siteDomain}/p/${slug}`
  return `${appUrl.replace(/\/+$/, '')}/p/${slug}`
}
