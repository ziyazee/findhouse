import { describe, expect, it } from 'vitest'
import { makeProperty } from '@/test/fixtures'
import { summarizePortfolio } from './portfolioSummary'

const now = new Date(2026, 10, 19)

describe('summarizePortfolio', () => {
  it('is all zeros for an empty portfolio', () => {
    expect(summarizePortfolio([], now)).toMatchObject({ total: 0, occupancy: 0, rentRoll: 0, avgRent: 0, addedThisMonth: 0 })
  })

  it('computes occupancy, rent roll and average rent from rentals only', () => {
    const s = summarizePortfolio([
      makeProperty({ id: '1', price: 40000, status: 'rented' }),
      makeProperty({ id: '2', price: 60000, status: 'available' }),
      makeProperty({ id: '3', price: 50001, status: 'available' }),
      makeProperty({ id: '4', price: 9_000_000, listingType: 'sale' }),
      makeProperty({ id: '5', price: null, status: 'sold' }),
    ], now)

    expect(s.total).toBe(5)
    expect(s.occupancy).toBeCloseTo(1 / 3)
    expect(s.rentRoll).toBe(40000)
    expect(s.avgRent).toBe(50000)
    expect(s.byStatus).toEqual({ active: 3, draft: 0, rented: 1, inactive: 1 })
  })

  it('counts properties added since the start of this month', () => {
    const s = summarizePortfolio([
      makeProperty({ id: '1', createdAt: new Date(2026, 10, 1, 0, 0, 1).toISOString() }),
      makeProperty({ id: '2', createdAt: new Date(2026, 9, 31, 23, 59).toISOString() }),
    ], now)
    expect(s.addedThisMonth).toBe(1)
  })
})
