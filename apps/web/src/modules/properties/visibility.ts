import { listingStatus } from './listingStatus'
import type { Property } from './property.types'

export type Visibility = 'public' | 'private'

export const VISIBILITY_META: Record<Visibility, { label: string; hint: string }> = {
  public:  { label: 'Public',  hint: 'Shown on your public page' },
  private: { label: 'Private', hint: 'Only people you send the link to can open it' },
}

export const visibilityOf = (p: Pick<Property, 'isPublic'>): Visibility => (p.isPublic ? 'public' : 'private')

/** On the broker's public page: made public, and live (on the market, with a price and a photo). */
export function onBrokerPage(p: Property): boolean {
  return p.isPublic && listingStatus(p) === 'active'
}

/** Why a public listing isn't on the broker's page yet, or null when it is (or is private). */
export function hiddenReason(p: Property): string | null {
  if (!p.isPublic || onBrokerPage(p)) return null
  const status = listingStatus(p)
  if (status === 'draft') return 'Shows once it has a price and a photo.'
  return 'Shows again when you mark it as active.'
}
