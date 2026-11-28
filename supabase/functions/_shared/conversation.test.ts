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

  it('adds details that arrive while a listing is built to it, and ignores another done', () => {
    for (const broker of [paid, trial]) {
      expect(decide(broker, 'PROPERTY_INFO', 'processing')).toEqual(store)
      expect(decide(broker, 'DONE', 'processing')).toEqual(ignore)
      expect(decide(broker, 'GREETING', 'processing')).toEqual(ignore)
    }
  })

  it('ignores a trial broker once the free listing is sent', () => {
    for (const kind of ['GREETING', 'PROPERTY_INFO', 'DONE', 'OTHER'] as const) {
      expect(decide(used, kind, 'none')).toEqual(ignore)
    }
  })
})

describe('ready message', () => {
  it('links the listing on the broker subdomain when there is one, else the main site', () => {
    const flat = { shortId: 'k3f9x2ab', title: '2 BHK in Andheri!' }
    expect(listingUrl(flat, 'https://findhouse.in', 'findhouse.in', 'ravi')).toBe('https://ravi.findhouse.in/k3f9x2ab/2-bhk-in-andheri')
    expect(listingUrl(flat, 'https://findhouse.in/', 'findhouse.in', null)).toBe('https://findhouse.in/k3f9x2ab/2-bhk-in-andheri')
    expect(listingUrl(flat, 'https://findhouse.in', undefined, 'ravi')).toBe('https://findhouse.in/k3f9x2ab/2-bhk-in-andheri')
    expect(listingUrl({ shortId: 'k3f9x2ab', title: '!!!' }, 'https://findhouse.in', 'findhouse.in', 'ravi')).toBe('https://ravi.findhouse.in/k3f9x2ab')
  })
})
