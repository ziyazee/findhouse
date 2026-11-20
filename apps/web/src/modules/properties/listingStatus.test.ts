import { describe, expect, it } from 'vitest'
import { makeMedia, makeProperty } from '@/test/fixtures'
import { STATUS_TO_DB, formatRent, isComplete, listingStatus, placeOf } from './listingStatus'

describe('listingStatus', () => {
  it('is active when available with a price and a photo', () => {
    expect(listingStatus(makeProperty())).toBe('active')
  })

  it('is a draft when available but missing the price', () => {
    expect(listingStatus(makeProperty({ price: null }))).toBe('draft')
  })

  it('is a draft when available but has only videos', () => {
    expect(listingStatus(makeProperty({ media: [makeMedia({ mediaType: 'video' })] }))).toBe('draft')
  })

  it('maps the stored statuses rented and sold', () => {
    expect(listingStatus(makeProperty({ status: 'rented', price: null, media: [] }))).toBe('rented')
    expect(listingStatus(makeProperty({ status: 'sold' }))).toBe('inactive')
  })

  it('round-trips the statuses a broker can choose', () => {
    expect(STATUS_TO_DB).toEqual({ active: 'available', rented: 'rented', inactive: 'sold' })
  })
})

describe('isComplete', () => {
  it('needs both a price and at least one image', () => {
    expect(isComplete(makeProperty())).toBe(true)
    expect(isComplete(makeProperty({ price: 0 }))).toBe(false)
    expect(isComplete(makeProperty({ media: [] }))).toBe(false)
  })
})

describe('formatRent', () => {
  it('formats in Indian grouping with a per-month suffix for rentals', () => {
    expect(formatRent(makeProperty({ price: 145000 }))).toBe('₹1,45,000/mo')
  })

  it('has no suffix for sales', () => {
    expect(formatRent(makeProperty({ listingType: 'sale', price: 8500000 }))).toBe('₹85,00,000')
  })

  it('abbreviates lakhs when compact', () => {
    expect(formatRent(makeProperty({ price: 150000 }), true)).toBe('₹1.5L/mo')
    expect(formatRent(makeProperty({ price: 200000 }), true)).toBe('₹2L/mo')
    expect(formatRent(makeProperty({ price: 45000 }), true)).toBe('₹45,000/mo')
  })

  it('shows a dash without a price', () => {
    expect(formatRent(makeProperty({ price: null }))).toBe('—')
  })
})

describe('placeOf', () => {
  it('avoids repeating the locality when the address already contains it', () => {
    expect(placeOf(makeProperty())).toBe('Bandra West, Mumbai')
  })

  it('prefixes the locality when the address does not mention it', () => {
    expect(placeOf(makeProperty({ locality: 'Khar', location: 'Mumbai' }))).toBe('Khar, Mumbai')
  })

  it('falls back to the locality, then a dash', () => {
    expect(placeOf(makeProperty({ location: null }))).toBe('Bandra West')
    expect(placeOf(makeProperty({ location: null, locality: null }))).toBe('—')
  })
})
