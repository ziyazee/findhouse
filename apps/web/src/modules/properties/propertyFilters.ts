import { LISTING_STATUSES, listingStatus, type ListingStatus } from './listingStatus'
import type { ListingType, Property } from './property.types'

export interface FilterState {
  search: string
  status: ListingStatus | ''
  listingType: ListingType | ''
  propertyType: string
}

export const EMPTY_FILTERS: FilterState = { search: '', status: '', listingType: '', propertyType: '' }

export function hasFilters(f: FilterState) {
  return !!(f.search || f.status || f.listingType || f.propertyType)
}

/** Search matches title, address or locality, ignoring case. */
export function filterProperties(properties: Property[], f: FilterState) {
  const q = f.search.trim().toLowerCase()
  return properties.filter((p) => {
    if (q && ![p.title, p.location, p.locality].some((v) => v?.toLowerCase().includes(q))) return false
    if (f.status && listingStatus(p) !== f.status) return false
    if (f.listingType && p.listingType !== f.listingType) return false
    if (f.propertyType && p.propertyType !== f.propertyType) return false
    return true
  })
}

export function countByStatus(properties: Property[]) {
  const counts = { all: properties.length } as Record<ListingStatus | 'all', number>
  for (const s of LISTING_STATUSES) counts[s] = 0
  for (const p of properties) counts[listingStatus(p)]++
  return counts
}

/** Reads `?status=` from a link; anything unknown means "all". */
export function parseStatus(v: string | null): ListingStatus | '' {
  return LISTING_STATUSES.includes(v as ListingStatus) ? (v as ListingStatus) : ''
}
