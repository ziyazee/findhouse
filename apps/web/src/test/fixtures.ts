import type { Property, PropertyMedia } from '@/modules/properties/property.types'

export function makeMedia(overrides: Partial<PropertyMedia> = {}): PropertyMedia {
  return {
    id: 'm1',
    propertyId: 'p1',
    mediaType: 'image',
    storagePath: 'properties/p1/photo.jpg',
    category: null,
    displayOrder: 0,
    isCover: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'p1',
    brokerId: 'b1',
    sessionId: null,
    slug: 'two-bhk-abc123',
    title: '2BHK in Bandra',
    propertyType: 'apartment',
    listingType: 'rent',
    status: 'available',
    price: 45000,
    deposit: null,
    location: 'Bandra West, Mumbai',
    locality: 'Bandra West',
    bedrooms: 2,
    bathrooms: 2,
    balconies: null,
    builtUpArea: 950,
    carpetArea: null,
    furnishing: 'semi-furnished',
    floor: '4',
    totalFloors: 12,
    parking: 'covered',
    moveInDate: null,
    amenities: [],
    description: null,
    other: {},
    isPublic: false,
    media: [makeMedia()],
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  }
}
