import { supabase } from '@/lib/supabase'
import type { CreatePropertyInput, Property, UpdatePropertyInput } from './property.types'
import { PROPERTY_SELECT, generateSlug, toProperty, toPropertyRow, type PropertyWithMediaRow } from './propertyMappers'

export interface IPropertyService {
  getProperties(brokerId: string): Promise<Property[]>
  /** Null when no such property is visible; throws on network or server errors. */
  getProperty(id: string): Promise<Property | null>
  getPropertyBySlug(slug: string): Promise<Property | null>
  /** Phone number guests can call or WhatsApp; null unless the listing is live and its broker is active. */
  getListingContact(id: string): Promise<string | null>
  /** The agent's name for "Listed by …"; null when they haven't set one or the listing isn't live. */
  getListingAgentName(id: string): Promise<string | null>
  /** A broker's public listings that are on the market, newest first. */
  getBrokerListings(brokerId: string): Promise<Property[]>
  createProperty(brokerId: string, data: CreatePropertyInput): Promise<Property>
  updateProperty(id: string, data: UpdatePropertyInput): Promise<Property>
  deleteProperty(id: string): Promise<void>
}

/** A lookup by an id that isn't a UUID is "not found", not a failure (old share links use `/:id`). */
const INVALID_UUID = '22P02'

class SupabasePropertyService implements IPropertyService {
  async getProperties(brokerId: string): Promise<Property[]> {
    const { data, error } = await supabase
      .from('properties')
      .select(PROPERTY_SELECT)
      .eq('broker_id', brokerId)
      .order('created_at', { ascending: false })
      .returns<PropertyWithMediaRow[]>()

    if (error) throw new Error(error.message)
    return (data ?? []).map(toProperty)
  }

  async getProperty(id: string): Promise<Property | null> {
    const { data, error } = await supabase
      .from('properties')
      .select(PROPERTY_SELECT)
      .eq('id', id)
      .returns<PropertyWithMediaRow[]>()
      .maybeSingle()

    if (error?.code === INVALID_UUID) return null
    if (error) throw new Error(error.message)
    return data ? toProperty(data) : null
  }

  async getPropertyBySlug(slug: string): Promise<Property | null> {
    const { data, error } = await supabase
      .from('properties')
      .select(PROPERTY_SELECT)
      .eq('slug', slug)
      .returns<PropertyWithMediaRow[]>()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data ? toProperty(data) : null
  }

  async getListingContact(id: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_listing_contact', { listing_id: id })
    if (error) return null
    return data || null
  }

  async getListingAgentName(id: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_listing_agent_name', { listing_id: id })
    if (error) return null
    return data?.trim() || null
  }

  async getBrokerListings(brokerId: string): Promise<Property[]> {
    const { data, error } = await supabase
      .from('properties')
      .select(PROPERTY_SELECT)
      .eq('broker_id', brokerId)
      .eq('is_public', true)
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .returns<PropertyWithMediaRow[]>()

    if (error?.code === INVALID_UUID) return []
    if (error) throw new Error(error.message)
    return (data ?? []).map(toProperty)
  }

  async createProperty(brokerId: string, input: CreatePropertyInput): Promise<Property> {
    const { data, error } = await supabase
      .from('properties')
      .insert({ ...toPropertyRow(input), title: input.title, broker_id: brokerId, slug: generateSlug(input.title) })
      .select(PROPERTY_SELECT)
      .returns<PropertyWithMediaRow[]>()
      .single()

    if (error) throw new Error(error.message)
    return toProperty(data)
  }

  async updateProperty(id: string, input: UpdatePropertyInput): Promise<Property> {
    const { data, error } = await supabase
      .from('properties')
      .update(toPropertyRow(input))
      .eq('id', id)
      .select(PROPERTY_SELECT)
      .returns<PropertyWithMediaRow[]>()
      .single()

    if (error) throw new Error(error.message)
    return toProperty(data)
  }

  async deleteProperty(id: string): Promise<void> {
    const { error } = await supabase.from('properties').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }
}

export const propertyService: IPropertyService = new SupabasePropertyService()
