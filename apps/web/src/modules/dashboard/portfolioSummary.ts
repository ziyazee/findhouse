import { LISTING_STATUSES, listingStatus, type ListingStatus } from '@/modules/properties/listingStatus'
import type { Property } from '@/modules/properties/property.types'

export interface PortfolioSummary {
  total: number
  byStatus: Record<ListingStatus, number>
  /** Share of rentals that are let, out of those let or on the market (0–1). */
  occupancy: number
  /** Monthly rent from rentals currently let. */
  rentRoll: number
  /** Average asking rent across rentals with a price, rounded to the rupee. */
  avgRent: number
  addedThisMonth: number
}

export function summarizePortfolio(properties: Property[], now = new Date()): PortfolioSummary {
  const byStatus = Object.fromEntries(LISTING_STATUSES.map((s) => [s, 0])) as Record<ListingStatus, number>
  for (const p of properties) byStatus[listingStatus(p)]++

  const rentals = properties.filter((p) => p.listingType === 'rent')
  const rented = rentals.filter((p) => p.status === 'rented')
  const onMarket = rentals.filter((p) => p.status === 'available')
  const priced = rentals.filter((p) => p.price)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  return {
    total: properties.length,
    byStatus,
    occupancy: rented.length + onMarket.length ? rented.length / (rented.length + onMarket.length) : 0,
    rentRoll: rented.reduce((t, p) => t + (p.price ?? 0), 0),
    avgRent: priced.length ? Math.round(priced.reduce((t, p) => t + (p.price ?? 0), 0) / priced.length) : 0,
    addedThisMonth: properties.filter((p) => new Date(p.createdAt) >= monthStart).length,
  }
}
