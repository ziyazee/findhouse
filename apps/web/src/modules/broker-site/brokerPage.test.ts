import { describe, expect, it } from 'vitest'
import { makeProperty } from '@/test/fixtures'
import { brokerEnquiryMessage, brokerPageListings, cardFacts, countByType, homesCount } from './brokerPage'

describe('brokerPage', () => {
  it('lists only public, live listings, newest first', () => {
    const older = makeProperty({ id: 'a', isPublic: true, createdAt: '2026-01-01T00:00:00.000Z' })
    const newer = makeProperty({ id: 'b', isPublic: true, createdAt: '2026-02-01T00:00:00.000Z' })
    const hidden = makeProperty({ id: 'c', isPublic: false })
    const draft = makeProperty({ id: 'd', isPublic: true, price: null })
    expect(brokerPageListings([older, hidden, newer, draft]).map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('writes the card facts it has', () => {
    expect(cardFacts({ bedrooms: 2, bathrooms: 1, builtUpArea: 1200 })).toEqual(['2 BHK', '1 bath', '1,200 sq ft'])
    expect(cardFacts({ bedrooms: null, bathrooms: 2, builtUpArea: null })).toEqual(['2 baths'])
  })

  it('counts homes and listing types', () => {
    expect(homesCount(1)).toBe('1 home')
    expect(homesCount(3)).toBe('3 homes')
    expect(countByType([makeProperty(), makeProperty({ listingType: 'sale' }), makeProperty()])).toEqual({ rent: 2, sale: 1 })
  })

  it('links the page in the WhatsApp message', () => {
    expect(brokerEnquiryMessage('https://x.test/b/1')).toMatch(/\nhttps:\/\/x\.test\/b\/1$/)
  })
})
