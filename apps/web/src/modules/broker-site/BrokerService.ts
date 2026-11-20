import { supabase } from '@/lib/supabase'

/** What a broker's public site shows about them. */
export interface BrokerProfile {
  id: string
  name: string | null
  phone: string | null
  /** Their public site's subdomain; null until they have a name or choose one. */
  subdomain: string | null
}

export type BrokerRef = { id: string } | { subdomain: string }

/** A subdomain the broker can't have, with the reason in words for them. */
export class SubdomainError extends Error {}

export interface IBrokerService {
  /** Null unless the broker exists and is active. */
  getProfile(ref: BrokerRef): Promise<BrokerProfile | null>
  /** Saves and returns the new subdomain; throws `SubdomainError` when it's taken, reserved or malformed. */
  setSubdomain(brokerId: string, subdomain: string): Promise<string>
}

const INVALID_UUID = '22P02'
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

  async setSubdomain(brokerId: string, subdomain: string): Promise<string> {
    const { data, error } = await supabase.rpc('set_broker_subdomain', { page_broker_id: brokerId, new_subdomain: subdomain })
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
