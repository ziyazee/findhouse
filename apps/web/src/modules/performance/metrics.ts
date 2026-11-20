import type { Property } from '@/modules/properties/property.types'
import type { IntakeItem } from '@/modules/submissions/submission.types'

export interface AreaRent {
  area: string
  avg: number
  count: number
}

/** Average asking rent per locality (or address), busiest areas first, top 6. */
export function rentByArea(properties: Property[]): AreaRent[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const p of properties) {
    if (p.listingType !== 'rent' || !p.price) continue
    const area = p.locality ?? p.location
    if (!area) continue
    const e = map.get(area) ?? { total: 0, count: 0 }
    e.total += p.price
    e.count++
    map.set(area, e)
  }
  return [...map.entries()]
    .map(([area, e]) => ({ area, avg: e.total / e.count, count: e.count }))
    .sort((a, b) => b.count - a.count || b.avg - a.avg)
    .slice(0, 6)
}

/** Properties added in each of the last 6 calendar months, oldest first. */
export function addedByMonth(properties: Property[], now = new Date()) {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const count = properties.filter((p) => {
      const c = new Date(p.createdAt)
      return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth()
    }).length
    return { key, label: d.toLocaleDateString('en-IN', { month: 'short' }), count }
  })
}

/** Share of finished WhatsApp submissions that became a property; null until one finishes. */
export function submissionSuccess(intake: Pick<IntakeItem, 'status'>[]) {
  const finished = intake.filter((s) => s.status === 'COMPLETED' || s.status === 'FAILED').length
  const completed = intake.filter((s) => s.status === 'COMPLETED').length
  return { finished, rate: finished ? completed / finished : null }
}
