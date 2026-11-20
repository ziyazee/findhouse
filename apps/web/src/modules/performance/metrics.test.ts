import { describe, expect, it } from 'vitest'
import { makeProperty } from '@/test/fixtures'
import { addedByMonth, rentByArea, submissionSuccess } from './metrics'

describe('rentByArea', () => {
  it('averages priced rentals per locality, busiest first, falling back to the address', () => {
    const areas = rentByArea([
      makeProperty({ id: '1', locality: 'Juhu', price: 50000 }),
      makeProperty({ id: '2', locality: 'Juhu', price: 70000 }),
      makeProperty({ id: '3', locality: null, location: 'Carter Rd', price: 90000 }),
      makeProperty({ id: '4', locality: 'Worli', price: 9_000_000, listingType: 'sale' }),
      makeProperty({ id: '5', locality: 'Powai', price: null }),
    ])
    expect(areas).toEqual([
      { area: 'Juhu', avg: 60000, count: 2 },
      { area: 'Carter Rd', avg: 90000, count: 1 },
    ])
  })

  it('keeps the top 6 areas', () => {
    const many = Array.from({ length: 8 }, (_, i) => makeProperty({ id: String(i), locality: `Area ${i}` }))
    expect(rentByArea(many)).toHaveLength(6)
  })
})

describe('addedByMonth', () => {
  it('buckets the last 6 calendar months, oldest first', () => {
    const now = new Date(2026, 0, 15)
    const months = addedByMonth([
      makeProperty({ id: '1', createdAt: new Date(2026, 0, 2).toISOString() }),
      makeProperty({ id: '2', createdAt: new Date(2025, 7, 20).toISOString() }),
      makeProperty({ id: '3', createdAt: new Date(2025, 6, 31).toISOString() }),
    ], now)
    expect(months.map((m) => m.key)).toEqual(['2025-7', '2025-8', '2025-9', '2025-10', '2025-11', '2026-0'])
    expect(months.map((m) => m.count)).toEqual([1, 0, 0, 0, 0, 1])
  })
})

describe('submissionSuccess', () => {
  it('ignores submissions still in progress', () => {
    expect(submissionSuccess([{ status: 'COMPLETED' }, { status: 'FAILED' }, { status: 'COLLECTING' }, { status: 'COMPLETED' }]))
      .toEqual({ finished: 3, rate: 2 / 3 })
    expect(submissionSuccess([{ status: 'PROCESSING' }])).toEqual({ finished: 0, rate: null })
  })
})
