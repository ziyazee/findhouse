import type { ListingType, Property } from '@/modules/properties/property.types'
import { onBrokerPage } from '@/modules/properties/visibility'

/** The listings a broker's public page shows, newest first. */
export function brokerPageListings(listings: Property[]): Property[] {
  return listings
    .filter(onBrokerPage)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Short facts under a listing card: "2 BHK · 2 baths · 950 sq ft". */
export function cardFacts(p: Pick<Property, 'bedrooms' | 'bathrooms' | 'builtUpArea'>): string[] {
  return [
    p.bedrooms != null && `${p.bedrooms} BHK`,
    p.bathrooms != null && `${p.bathrooms} ${p.bathrooms === 1 ? 'bath' : 'baths'}`,
    p.builtUpArea != null && `${p.builtUpArea.toLocaleString('en-IN')} sq ft`,
  ].filter((s): s is string => Boolean(s))
}

export const homesCount = (n: number) => `${n} ${n === 1 ? 'home' : 'homes'}`

/** How many listings are for rent and for sale. */
export function countByType(listings: Pick<Property, 'listingType'>[]): Record<ListingType, number> {
  return {
    rent: listings.filter((p) => p.listingType === 'rent').length,
    sale: listings.filter((p) => p.listingType === 'sale').length,
  }
}

export function brokerEnquiryMessage(pageUrl: string) {
  return `Hi, I saw your homes on FindHouse. What do you have available right now?\n${pageUrl}`
}
