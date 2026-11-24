import { describe, expect, it } from 'vitest'
import { enquiryRate, perDay, perProperty, totalsOf, type StatRow } from './metrics'

const rows: StatRow[] = [
  { property_id: 'a', kind: 'view', day: '2026-11-24', n: 10 },
  { property_id: 'a', kind: 'whatsapp', day: '2026-11-24', n: 2 },
  { property_id: 'a', kind: 'call', day: '2026-11-25', n: 1 },
  { property_id: 'b', kind: 'view', day: '2026-11-25', n: 30 },
  { property_id: 'b', kind: 'share', day: '2026-11-25', n: 4 },
]

describe('totalsOf', () => {
  it('adds each kind, and counts calls and WhatsApp taps as enquiries', () => {
    expect(totalsOf(rows)).toEqual({ views: 40, shares: 4, calls: 1, whatsapp: 2, enquiries: 3 })
  })
  it('ignores kinds it does not know', () => {
    expect(totalsOf([{ property_id: 'a', kind: 'other', day: '2026-11-25', n: 5 }]).views).toBe(0)
  })
})

describe('enquiryRate', () => {
  it('is enquiries per view', () => {
    expect(enquiryRate(totalsOf(rows))).toBeCloseTo(3 / 40)
  })
  it('is null before there is a view', () => {
    expect(enquiryRate(totalsOf([]))).toBeNull()
  })
})

describe('perDay', () => {
  it('lists every day, oldest first, filling quiet days with zero', () => {
    const days = perDay(rows, 3, new Date(2026, 10, 25))
    expect(days.map((d) => d.key)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25'])
    expect(days.map((d) => d.views)).toEqual([0, 10, 30])
    expect(days.map((d) => d.enquiries)).toEqual([0, 2, 1])
  })
})

describe('perProperty', () => {
  it('ranks by enquiries, then views, and keeps properties with no activity', () => {
    const list = perProperty(rows, [{ id: 'c', title: 'C' }, { id: 'b', title: 'B' }, { id: 'a', title: 'A' }])
    expect(list.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(list[2].views).toBe(0)
  })
})
