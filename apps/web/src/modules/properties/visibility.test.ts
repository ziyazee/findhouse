import { describe, expect, it } from 'vitest'
import { makeProperty } from '@/test/fixtures'
import { hiddenReason, onBrokerPage, visibilityOf } from './visibility'

describe('visibility', () => {
  it('reads public and private from the flag', () => {
    expect(visibilityOf(makeProperty({ isPublic: true }))).toBe('public')
    expect(visibilityOf(makeProperty())).toBe('private')
  })

  it('shows only public, live listings on the broker page', () => {
    expect(onBrokerPage(makeProperty({ isPublic: true }))).toBe(true)
    expect(onBrokerPage(makeProperty({ isPublic: false }))).toBe(false)
    expect(onBrokerPage(makeProperty({ isPublic: true, status: 'rented' }))).toBe(false)
    expect(onBrokerPage(makeProperty({ isPublic: true, price: null }))).toBe(false)
    expect(onBrokerPage(makeProperty({ isPublic: true, media: [] }))).toBe(false)
  })

  it('explains why a public listing is not on the page yet', () => {
    expect(hiddenReason(makeProperty({ isPublic: true }))).toBeNull()
    expect(hiddenReason(makeProperty())).toBeNull()
    expect(hiddenReason(makeProperty({ isPublic: true, price: null }))).toMatch(/price and a photo/)
    expect(hiddenReason(makeProperty({ isPublic: true, status: 'sold' }))).toMatch(/mark it as active/)
  })
})
