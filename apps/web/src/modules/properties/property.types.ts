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
  brokerId: string
  sessionId: string | null
  slug: string
  title: string
  propertyType: string
  listingType: ListingType
  status: PropertyStatus
  price: number | null
  location: string | null
  locality: string | null
  bedrooms: number | null
  bathrooms: number | null
  builtUpArea: number | null
  carpetArea: number | null
  furnishing: string | null
  floor: string | null
  totalFloors: number | null
  parking: string | null
  amenities: string[]
  description: string | null
  media: PropertyMedia[]
  createdAt: string
  updatedAt: string
}

export interface CreatePropertyInput {
  title: string
  propertyType: string
  listingType: ListingType
  price?: number
  location?: string
  locality?: string
  bedrooms?: number
  bathrooms?: number
  builtUpArea?: number
  carpetArea?: number
  furnishing?: string
  floor?: string
  totalFloors?: number
  parking?: string
  amenities?: string[]
  description?: string
}

export type UpdatePropertyInput = Partial<CreatePropertyInput> & {
  status?: PropertyStatus
}
