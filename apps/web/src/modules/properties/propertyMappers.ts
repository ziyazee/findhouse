import type { Database } from '@/lib/database.types'
import type { ListingType, MediaType, Property, PropertyMedia, PropertyStatus, UpdatePropertyInput } from './property.types'

type Tables = Database['public']['Tables']
export type PropertyRow = Tables['properties']['Row']
export type MediaRow = Tables['property_media']['Row']
export type PropertyUpdateRow = Tables['properties']['Update']
export type PropertyWithMediaRow = PropertyRow & { property_media: MediaRow[] | null }

/** Columns selected for every property read, with its media. */
export const PROPERTY_SELECT = '*, property_media!property_media_property_id_fkey(*)'

const STATUSES: readonly PropertyStatus[] = ['available', 'rented', 'sold']

/** Unknown statuses read as `sold` (off the market) so nothing is shown as live by mistake. */
function toStatus(value: string): PropertyStatus {
  return STATUSES.includes(value as PropertyStatus) ? (value as PropertyStatus) : 'sold'
}

function toListingType(value: string): ListingType {
  return value === 'sale' ? 'sale' : 'rent'
}

function toMediaType(value: string): MediaType {
  return value === 'video' ? 'video' : 'image'
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function toMedia(row: MediaRow): PropertyMedia {
  return {
    id: row.id,
    propertyId: row.property_id,
    mediaType: toMediaType(row.media_type),
    storagePath: row.storage_path,
    category: row.category,
    displayOrder: row.display_order,
    isCover: row.is_cover,
    createdAt: row.created_at,
  }
}

export function toProperty(row: PropertyWithMediaRow): Property {
  return {
    id: row.id,
    brokerId: row.broker_id,
    sessionId: row.session_id,
    slug: row.slug,
    shortId: row.short_id,
    title: row.title,
    propertyType: row.property_type,
    listingType: toListingType(row.listing_type),
    status: toStatus(row.status),
    price: row.price,
    deposit: row.deposit,
    location: row.location,
    locality: row.locality,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    balconies: row.balconies,
    builtUpArea: row.built_up_area,
    carpetArea: row.carpet_area,
    furnishing: row.furnishing,
    floor: row.floor,
    totalFloors: row.total_floors,
    parking: row.parking,
    moveInDate: row.move_in_date,
    amenities: row.amenities ?? [],
    description: row.description,
    other: isRecord(row.other) ? row.other : {},
    // Missing until migration 011 runs, and anything but `true` reads as private.
    isPublic: row.is_public === true,
    media: (row.property_media ?? []).map(toMedia),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** `undefined` fields are dropped from the request (left unchanged); `null` clears the column. */
export function toPropertyRow(input: UpdatePropertyInput): PropertyUpdateRow {
  return {
    title: input.title,
    status: input.status,
    property_type: input.propertyType,
    listing_type: input.listingType,
    price: input.price,
    deposit: input.deposit,
    location: input.location,
    locality: input.locality,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    balconies: input.balconies,
    built_up_area: input.builtUpArea,
    carpet_area: input.carpetArea,
    furnishing: input.furnishing,
    floor: input.floor,
    total_floors: input.totalFloors,
    parking: input.parking,
    move_in_date: input.moveInDate,
    amenities: input.amenities,
    description: input.description,
    other: input.other,
    is_public: input.isPublic,
  }
}

export function generateSlug(title: string, random: () => number = Math.random): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
  const suffix = random().toString(36).slice(2, 8)
  return `${base}-${suffix}`
}
