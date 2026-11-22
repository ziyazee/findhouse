import { supabase } from '@/lib/supabase'
import type { Property } from '@/modules/properties/property.types'
import { propertyService } from '@/modules/properties/PropertyService'
import { toProperty, type PropertyWithMediaRow } from '@/modules/properties/propertyMappers'

/** What a broker's public site shows about them. */
export interface BrokerProfile {
  id: string
  name: string | null
  phone: string | null
  /** Their public site's subdomain; null until they have a name or choose one. */
  subdomain: string | null
}

/** What a broker's public page shows: the broker and their public listings. */
export interface BrokerSite {
  profile: BrokerProfile
  listings: Property[]
}

export type BrokerRef = { id: string } | { subdomain: string }

/** A subdomain the broker can't have, with the reason in words for them. */
export class SubdomainError extends Error {}

export interface IBrokerService {
  /** Null unless the broker exists and is active. */
  getProfile(ref: BrokerRef): Promise<BrokerProfile | null>
  /** The broker and their public listings in one request; null unless the broker exists and is active. */
  getSite(ref: BrokerRef): Promise<BrokerSite | null>
  /** Saves and returns the signed-in broker's new subdomain; throws `SubdomainError` when it's taken, reserved or malformed. */
  setSubdomain(subdomain: string): Promise<string>
}

const INVALID_UUID = '22P02'
/** PostgREST: no such function (a migration hasn't been run). */
const FUNCTION_MISSING = 'PGRST202'
const TAKEN = '23505'
const BAD_VALUE = '22023'

class SupabaseBrokerService implements IBrokerService {
  async getProfile(ref: BrokerRef): Promise<BrokerProfile | null> {
    const args = 'id' in ref ? { page_broker_id: ref.id } : { page_subdomain: ref.subdomain }
    const { data, error } = await supabase.rpc('get_broker_page', args)
    if (error?.code === INVALID_UUID) return null
    if (error) throw new Error(error.message)
    const row = data?.[0]
    if (!row) return null
    return {
      // Before migration 012 the function returns only name and phone.
      id: row.id ?? ('id' in ref ? ref.id : ''),
      name: row.name?.trim() || null,
      phone: row.phone || null,
      subdomain: row.subdomain ?? null,
    }
  }

  async getSite(ref: BrokerRef): Promise<BrokerSite | null> {
    const args = 'id' in ref ? { page_broker_id: ref.id } : { page_subdomain: ref.subdomain }
    const { data, error } = await supabase.rpc('get_broker_site', args)

    if (error?.code === INVALID_UUID) return null
    if (error?.code === FUNCTION_MISSING) return this.getSiteInTwoSteps(ref) // migration 019 isn't run yet
    if (error) throw new Error(error.message)
    if (!data) return null

    const site = data as { id: string; name: string | null; phone: string | null; subdomain: string | null; listings: PropertyWithMediaRow[] | null }
    return {
      profile: { id: site.id, name: site.name?.trim() || null, phone: site.phone || null, subdomain: site.subdomain ?? null },
      listings: (site.listings ?? []).map(toProperty),
    }
  }

  /** The same page as two requests, for a database that doesn't have get_broker_site yet. */
  private async getSiteInTwoSteps(ref: BrokerRef): Promise<BrokerSite | null> {
    const profile = await this.getProfile(ref)
    if (!profile) return null
    return { profile, listings: await propertyService.getBrokerListings(profile.id) }
  }

  async setSubdomain(subdomain: string): Promise<string> {
    const { data, error } = await supabase.rpc('set_my_subdomain', { new_subdomain: subdomain })
    if (error?.code === TAKEN) throw new SubdomainError('Another broker already has that name. Try another.')
    if (error?.code === BAD_VALUE) {
      throw new SubdomainError(error.message === 'reserved'
        ? 'That name is reserved for FindHouse. Try another.'
        : 'Use 3 to 32 lowercase letters, numbers and hyphens.')
    }
    if (error) throw new Error(error.message)
    return data
  }
}

export const brokerService: IBrokerService = new SupabaseBrokerService()
