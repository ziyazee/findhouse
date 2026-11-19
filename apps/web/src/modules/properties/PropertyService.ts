import type { Property, CreatePropertyInput, UpdatePropertyInput } from './property.types'
import { supabase } from '@/lib/supabase'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IPropertyService {
  getProperties(brokerId: string): Promise<Property[]>
  getProperty(id: string): Promise<Property | null>
  getPropertyBySlug(slug: string): Promise<Property | null>
  /** Phone number guests can call or WhatsApp; null unless the listing is live and its broker is active. */
  getListingContact(id: string): Promise<string | null>
  createProperty(brokerId: string, data: CreatePropertyInput): Promise<Property>
  updateProperty(id: string, data: UpdatePropertyInput): Promise<Property>
  deleteProperty(id: string): Promise<void>
}

// ── Supabase Implementation ───────────────────────────────────────────────────

class SupabasePropertyService implements IPropertyService {
  async getProperties(brokerId: string): Promise<Property[]> {
    const { data, error } = await supabase
      .from('properties')
      .select('*, property_media!property_media_property_id_fkey(*)')
      .eq('broker_id', brokerId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map(toProperty as any)
  }

  async getProperty(id: string): Promise<Property | null> {
    const { data, error } = await supabase
      .from('properties')
      .select('*, property_media!property_media_property_id_fkey(*)')
      .eq('id', id)
      .single()

    if (error) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return toProperty(data as any)
  }

  async getPropertyBySlug(slug: string): Promise<Property | null> {
    const { data, error } = await supabase
      .from('properties')
      .select('*, property_media!property_media_property_id_fkey(*)')
      .eq('slug', slug)
      .single()

    if (error) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return toProperty(data as any)
  }

  async getListingContact(id: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_listing_contact', { listing_id: id })
    if (error) return null
    return data || null
  }

  async createProperty(brokerId: string, input: CreatePropertyInput): Promise<Property> {
    const slug = generateSlug(input.title)
    const { data, error } = await supabase
      .from('properties')
      .insert({ ...toRow(input), title: input.title, broker_id: brokerId, slug })
      .select('*, property_media!property_media_property_id_fkey(*)')
      .single()

    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return toProperty(data as any)
  }

  async updateProperty(id: string, input: UpdatePropertyInput): Promise<Property> {
    const { data, error } = await supabase
      .from('properties')
      .update(toRow(input))
      .eq('id', id)
      .select('*, property_media!property_media_property_id_fkey(*)')
      .single()

    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return toProperty(data as any)
  }

  async deleteProperty(id: string): Promise<void> {
    const { error } = await supabase.from('properties').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }
}

// ── Mappers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProperty(row: Record<string, any>): Property {
  return {
    id: row.id,
    brokerId: row.broker_id,
    sessionId: row.session_id,
    slug: row.slug,
    title: row.title,
    propertyType: row.property_type,
    listingType: row.listing_type,
    status: row.status,
    price: row.price,
    location: row.location,
    locality: row.locality,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    builtUpArea: row.built_up_area,
    carpetArea: row.carpet_area,
    furnishing: row.furnishing,
    floor: row.floor,
    totalFloors: row.total_floors,
    parking: row.parking,
    amenities: row.amenities ?? [],
    description: row.description,
    media: (row.property_media ?? []).map(toMedia),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMedia(row: Record<string, any>) {
  return {
    id: row.id,
    propertyId: row.property_id,
    mediaType: row.media_type,
    storagePath: row.storage_path,
    category: row.category,
    displayOrder: row.display_order,
    isCover: row.is_cover,
    createdAt: row.created_at,
  }
}

function toRow(input: UpdatePropertyInput) {
  return {
    title: input.title,
    status: input.status,
    property_type: input.propertyType,
    listing_type: input.listingType,
    price: input.price,
    location: input.location,
    locality: input.locality,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    built_up_area: input.builtUpArea,
    carpet_area: input.carpetArea,
    furnishing: input.furnishing,
    floor: input.floor,
    total_floors: input.totalFloors,
    parking: input.parking,
    amenities: input.amenities,
    description: input.description,
  }
}

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}-${suffix}`
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createPropertyService(): IPropertyService {
  return new SupabasePropertyService()
}
