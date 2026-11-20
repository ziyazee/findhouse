import type { BadgeVariant } from '@/shared/components/Badge'
import { getMediaUrl } from '@/lib/storage'
import type { Property, PropertyStatus } from './property.types'

export type ListingStatus = 'active' | 'draft' | 'rented' | 'inactive'

export const LISTING_STATUSES: ListingStatus[] = ['active', 'draft', 'rented', 'inactive']

export const STATUS_META: Record<ListingStatus, { label: string; variant: BadgeVariant; hint: string }> = {
  active:   { label: 'Active',   variant: 'green', hint: 'Live and ready to share' },
  draft:    { label: 'Draft',    variant: 'amber', hint: 'Missing rent or photos, so not ready to share' },
  rented:   { label: 'Rented',   variant: 'blue',  hint: 'A tenant has moved in' },
  inactive: { label: 'Inactive', variant: 'grey',  hint: 'Taken off the market' },
}

// Draft is derived: the DB only stores available | rented | sold.
export function isComplete(p: Property) {
  return !!p.price && p.media.some((m) => m.mediaType === 'image')
}

export function listingStatus(p: Property): ListingStatus {
  if (p.status === 'rented') return 'rented'
  if (p.status === 'sold') return 'inactive'
  return isComplete(p) ? 'active' : 'draft'
}

export const STATUS_TO_DB: Record<Exclude<ListingStatus, 'draft'>, PropertyStatus> = {
  active: 'available',
  rented: 'rented',
  inactive: 'sold',
}

export function coverUrl(p: Property): string | null {
  const cover = p.media.find((m) => m.isCover) ?? p.media.find((m) => m.mediaType === 'image')
  return cover ? getMediaUrl(cover.storagePath) : null
}

export function formatRent(p: Property, compact = false): string {
  if (!p.price) return '—'
  const n = compact && p.price >= 100_000
    ? `${(p.price / 100_000).toFixed(p.price % 100_000 ? 1 : 0)}L`
    : p.price.toLocaleString('en-IN')
  return `₹${n}${p.listingType === 'rent' ? '/mo' : ''}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function placeOf(p: Property): string {
  const { locality, location } = p
  if (!location) return locality || '—'
  if (!locality || location.toLowerCase().includes(locality.toLowerCase())) return location
  return `${locality}, ${location}`
}
