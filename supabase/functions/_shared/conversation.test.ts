import { describe, expect, it } from 'vitest'
import { decide, displayHost, listingUrl, replyText, type BrokerState } from './conversation.ts'

const paid: BrokerState = { plan: 'paid', welcomed: false, trialUsed: false }
const fresh: BrokerState = { plan: 'trial', welcomed: false, trialUsed: false }
const welcomed: BrokerState = { ...fresh, welcomed: true }
const used: BrokerState = { ...welcomed, trialUsed: true }

describe('decide: paid brokers', () => {
  it('keep the usual flow and get a short hint for a greeting', () => {
    expect(decide(paid, 'GREETING', 'none')).toEqual({ store: false, finalize: false, reply: 'paid_hint' })
    expect(decide(paid, 'GREETING', 'collecting').reply).toBe('keep_going')
    expect(decide(paid, 'PROPERTY_INFO', 'none')).toEqual({ store: true, finalize: false, reply: null })
    expect(decide(paid, 'DONE', 'collecting')).toEqual({ store: true, finalize: true, reply: null })
    expect(decide(paid, 'DONE', 'none')).toEqual({ store: false, finalize: false, reply: null })
    expect(decide(paid, 'OTHER', 'none').reply).toBeNull()
  })
})

describe('decide: trial brokers', () => {
  it('welcomes a new number and drops whatever it sent first', () => {
    for (const kind of ['GREETING', 'PROPERTY_INFO', 'DONE'] as const) {
      expect(decide(fresh, kind, 'none')).toEqual({ store: false, finalize: false, reply: 'welcome' })
    }
  })

  it('collects the free listing after the welcome', () => {
    expect(decide(welcomed, 'GREETING', 'none').reply).toBe('start_hint')
    expect(decide(welcomed, 'DONE', 'none').reply).toBe('start_hint')
    expect(decide(welcomed, 'PROPERTY_INFO', 'none').store).toBe(true)
    expect(decide(welcomed, 'PROPERTY_INFO', 'collecting').store).toBe(true)
    expect(decide(welcomed, 'GREETING', 'collecting').reply).toBe('keep_going')
    expect(decide(welcomed, 'DONE', 'collecting')).toEqual({ store: true, finalize: true, reply: 'building' })
  })

  it('stays quiet while the listing is being built', () => {
    expect(decide(welcomed, 'PROPERTY_INFO', 'processing')).toEqual({ store: false, finalize: false, reply: null })
  })

  it('answers everything with the plans once the free listing is used', () => {
    for (const kind of ['GREETING', 'PROPERTY_INFO', 'DONE', 'OTHER'] as const) {
      expect(decide(used, kind, 'none')).toEqual({ store: false, finalize: false, reply: 'trial_over' })
    }
  })
})

describe('texts and links', () => {
  it('shows the site without its scheme', () => {
    expect(displayHost('https://findhouse.in/')).toBe('findhouse.in')
    expect(replyText('welcome', 'https://findhouse.in')).toContain('Sign in at findhouse.in')
  })

  it('lists both plans', () => {
    const text = replyText('trial_over', 'https://findhouse.in')
    expect(text).toContain('₹499 a month')
    expect(text).toContain('₹4,999 a year (2 months free)')
  })

  it('links the listing on the broker subdomain when there is one', () => {
    expect(listingUrl('flat-x1', 'https://findhouse.in', 'findhouse.in', 'ravi')).toBe('https://ravi.findhouse.in/p/flat-x1')
    expect(listingUrl('flat-x1', 'https://findhouse.in/', 'findhouse.in', null)).toBe('https://findhouse.in/p/flat-x1')
    expect(listingUrl('flat-x1', 'https://findhouse.in', undefined, 'ravi')).toBe('https://findhouse.in/p/flat-x1')
  })
})
