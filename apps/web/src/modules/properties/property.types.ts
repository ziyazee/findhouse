export type PropertyStatus = 'available' | 'sold' | 'rented'
export type ListingType = 'sale' | 'rent'
export type MediaType = 'image' | 'video'

export interface PropertyMedia {
  id: string
  propertyId: string
  mediaType: MediaType
  storagePath: string
  category: string | null
  displayOrder: number
  isCover: boolean
  createdAt: string
}

export interface Property {
  id: string
  /** Null only if the broker record was removed; properties outlive their broker. */
  brokerId: string | null
  sessionId: string | null
  slug: string
  /** Short code used in the public link: /<shortId>/<name>. */
  shortId: string
  title: string
  propertyType: string
  listingType: ListingType
  status: PropertyStatus
  price: number | null
  deposit: number | null
  location: string | null
  locality: string | null
  bedrooms: number | null
  bathrooms: number | null
  balconies: number | null
  builtUpArea: number | null
  carpetArea: number | null
  furnishing: string | null
  floor: string | null
  totalFloors: number | null
  parking: string | null
  /** Free text from the extractor, e.g. "immediate" or "1st January". */
  moveInDate: string | null
  amenities: string[]
  description: string | null
  /** Extra details, under keys the extractor chose (e.g. "maintenanceCharge") or labels the broker typed. */
  other: Record<string, unknown>
  /** Shown on the broker's public page. A private listing still opens from its link. */
  isPublic: boolean
  media: PropertyMedia[]
  createdAt: string
  updatedAt: string
}

/** Optional fields: omit to leave unchanged, `null` to clear. */
export interface CreatePropertyInput {
  title: string
  propertyType: string
  listingType: ListingType
  price?: number | null
  deposit?: number | null
  location?: string | null
  locality?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  balconies?: number | null
  builtUpArea?: number | null
  carpetArea?: number | null
  furnishing?: string | null
  floor?: string | null
  totalFloors?: number | null
  parking?: string | null
  moveInDate?: string | null
  amenities?: string[]
  description?: string | null
  /** Replaces the whole set of extra details. */
  other?: Record<string, unknown>
}

export type UpdatePropertyInput = Partial<CreatePropertyInput> & {
  status?: PropertyStatus
  isPublic?: boolean
}
