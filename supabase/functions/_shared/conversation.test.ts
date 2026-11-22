import { describe, expect, it } from 'vitest'
import { decide, listingUrl, type BrokerState } from './conversation.ts'

const paid: BrokerState = { plan: 'paid', trialUsed: false }
const trial: BrokerState = { plan: 'trial', trialUsed: false }
const used: BrokerState = { plan: 'trial', trialUsed: true }

const ignore = { store: false, finalize: false }
const store = { store: true, finalize: false }
const build = { store: true, finalize: true }

describe('decide', () => {
  it('keeps details and builds on done, even before a submission is open', () => {
    for (const broker of [paid, trial]) {
      expect(decide(broker, 'PROPERTY_INFO', 'none')).toEqual(store)
      expect(decide(broker, 'PROPERTY_INFO', 'collecting')).toEqual(store)
      expect(decide(broker, 'DONE', 'collecting')).toEqual(build)
      expect(decide(broker, 'DONE', 'none')).toEqual(build)
    }
  })

  it('keeps a new trial number’s first message', () => {
    expect(decide(trial, 'PROPERTY_INFO', 'none')).toEqual(store)
  })

  it('ignores greetings and empty messages', () => {
    expect(decide(paid, 'GREETING', 'collecting')).toEqual(ignore)
    expect(decide(trial, 'OTHER', 'none')).toEqual(ignore)
  })

  it('ignores a trial broker while the free listing is built and once it is used', () => {
    expect(decide(trial, 'PROPERTY_INFO', 'processing')).toEqual(ignore)
    expect(decide(trial, 'DONE', 'processing')).toEqual(ignore)
    for (const kind of ['GREETING', 'PROPERTY_INFO', 'DONE', 'OTHER'] as const) {
      expect(decide(used, kind, 'none')).toEqual(ignore)
    }
  })

  it('lets paid brokers keep going while a listing is built', () => {
    expect(decide(paid, 'PROPERTY_INFO', 'processing')).toEqual(store)
  })
})

describe('ready message', () => {
  it('links the listing on the broker subdomain when there is one, else the main site', () => {
    expect(listingUrl('flat-x1', 'https://findhouse.in', 'findhouse.in', 'ravi')).toBe('https://ravi.findhouse.in/p/flat-x1')
    expect(listingUrl('flat-x1', 'https://findhouse.in/', 'findhouse.in', null)).toBe('https://findhouse.in/p/flat-x1')
    expect(listingUrl('flat-x1', 'https://findhouse.in', undefined, 'ravi')).toBe('https://findhouse.in/p/flat-x1')
  })
})
