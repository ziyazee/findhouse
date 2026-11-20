import { describe, expect, it } from 'vitest'
import { makeProperty } from '@/test/fixtures'
import { EMPTY_FILTERS, countByStatus, filterProperties, hasFilters, parseStatus } from './propertyFilters'

const active = makeProperty({ id: 'a', title: 'Sea view flat', locality: 'Bandra West' })
const draft = makeProperty({ id: 'd', title: 'Garden villa', locality: 'Juhu', propertyType: 'villa', price: null })
const rented = makeProperty({ id: 'r', title: 'Studio', locality: 'Andheri', status: 'rented' })
const forSale = makeProperty({ id: 's', title: 'Penthouse', locality: 'Worli', listingType: 'sale', status: 'sold' })
const all = [active, draft, rented, forSale]

describe('filterProperties', () => {
  it('returns everything with no filters', () => {
    expect(filterProperties(all, EMPTY_FILTERS)).toHaveLength(4)
  })

  it('searches title and locality, ignoring case and spaces', () => {
    expect(filterProperties(all, { ...EMPTY_FILTERS, search: '  JUHU ' }).map((p) => p.id)).toEqual(['d'])
    expect(filterProperties(all, { ...EMPTY_FILTERS, search: 'sea' }).map((p) => p.id)).toEqual(['a'])
  })

  it('combines status, listing type and property type', () => {
    expect(filterProperties(all, { ...EMPTY_FILTERS, status: 'draft' }).map((p) => p.id)).toEqual(['d'])
    expect(filterProperties(all, { ...EMPTY_FILTERS, listingType: 'sale' }).map((p) => p.id)).toEqual(['s'])
    expect(filterProperties(all, { ...EMPTY_FILTERS, propertyType: 'villa', status: 'active' })).toEqual([])
  })
})

describe('countByStatus', () => {
  it('counts every derived status', () => {
    expect(countByStatus(all)).toEqual({ all: 4, active: 1, draft: 1, rented: 1, inactive: 1 })
  })
})

describe('hasFilters / parseStatus', () => {
  it('detects any active filter', () => {
    expect(hasFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasFilters({ ...EMPTY_FILTERS, propertyType: 'house' })).toBe(true)
  })

  it('accepts only known statuses from links', () => {
    expect(parseStatus('rented')).toBe('rented')
    expect(parseStatus('available')).toBe('')
    expect(parseStatus(null)).toBe('')
  })
})
