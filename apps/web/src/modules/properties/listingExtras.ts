import type { Property } from './property.types'

/**
 * Details the extractor stores outside the main columns. `other` is free-form: the model picks the keys
 * ("maintenanceCharge", "maintenance charge", "facing_direction") and values may be numbers or text.
 */

const MAINTENANCE_KEY = /mainten/i
/** A plain amount, optionally monthly: "3500", "₹3,500/month", "Rs. 3500/-", "3500 per month", "3500 pm", "2k", "1.5 thousand". */
const MONTHLY_AMOUNT = /^(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?)?\s*(?:\/-)?\s*(?:(?:\/|per|a)\s*(?:month|mo)|p\.?\s?m\.?|monthly)?$/i
const UNIT = (u: string | undefined) => (!u ? 1 : /^(?:k|thousand)$/i.test(u) ? 1e3 : 1e5)

/** A Google Maps link, full ("google.com/maps/…", "maps.google.com/…") or shortened ("maps.app.goo.gl/…", "goo.gl/maps/…"). */
export const MAPS_URL = /https?:\/\/(?:www\.)?(?:google\.[a-z.]{2,6}\/maps|maps\.google\.[a-z.]{2,6}|maps\.app\.goo\.gl|goo\.gl\/maps)[^\s"'<>]*/i

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Rental terms the extractor is asked for by key, in the order Property details lists them. */
const RENTAL_TERMS: Record<string, string> = {
  preferredtenants: 'Preferred tenants',
  petsallowed: 'Pets allowed',
  nonvegallowed: 'Non-veg allowed',
  lockinperiod: 'Lock-in period',
  noticeperiod: 'Notice period',
  brokerage: 'Brokerage',
}
const termKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '')
const termRank = (key: string) => {
  const i = Object.keys(RENTAL_TERMS).indexOf(termKey(key))
  return i < 0 ? 99 : i
}

/** "maintenanceCharge", "water_supply" or "age of property" → "Maintenance charge", "Water supply", "Age of property". */
export function extraLabel(key: string) {
  const term = RENTAL_TERMS[termKey(key)]
  if (term) return term
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  return capitalise(words)
}

/** A free-form value as display text, or null when there's nothing worth showing. */
export function extraValue(v: unknown): string | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v.toLocaleString('en-IN') : null
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'string') return v.trim() ? capitalise(v.trim()) : null
  const parts = Array.isArray(v)
    ? v.map(extraValue)
    : v && typeof v === 'object'
      ? Object.entries(v).map(([k, x]) => { const s = extraValue(x); return s && `${extraLabel(k)}: ${s}` })
      : []
  return parts.filter(Boolean).join(', ') || null
}

/** The key in `other` that holds the maintenance charge, if there is one. */
export function maintenanceKey(other: Record<string, unknown>) {
  const key = Object.keys(other).find((k) => MAINTENANCE_KEY.test(k) && extraValue(other[k]) != null)
  return key && (typeof other[key] !== 'boolean' || /includ/i.test(key)) ? key : undefined
}

export function monthlyAmount(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null
  const m = typeof v === 'string' ? MONTHLY_AMOUNT.exec(v.trim()) : null
  return m ? Math.round(Number(m[1].replace(/,/g, '')) * UNIT(m[2])) : null
}

/** The maintenance line shown under the price, e.g. "+ ₹3,500 maintenance" on a rental. */
export function maintenanceLine(p: Pick<Property, 'other' | 'listingType'>): string | null {
  const key = maintenanceKey(p.other)
  if (!key) return null
  const v = p.other[key]
  const amount = monthlyAmount(v)
  if (amount === 0) return 'No maintenance charge'
  if (amount != null) return p.listingType === 'rent' ? `+ ${rupees(amount)} maintenance` : `${rupees(amount)}/month maintenance`
  if (typeof v === 'boolean') return `Maintenance ${v ? '' : 'not '}included`
  const text = extraValue(v)!
  return /^includ/i.test(text) ? 'Maintenance included' : `Maintenance: ${text}`
}

/** The maintenance charge as a Property details value: "₹3,500/month", "None", "Included" or the broker's text. */
export function maintenanceValue(p: Pick<Property, 'other'>): string | null {
  const key = maintenanceKey(p.other)
  if (!key) return null
  const v = p.other[key]
  const amount = monthlyAmount(v)
  if (amount === 0) return 'None'
  if (amount != null) return `${rupees(amount)}/month`
  if (typeof v === 'boolean') return v ? 'Included' : 'Not included'
  const text = extraValue(v)!
  return /^includ/i.test(text) ? 'Included' : text
}

/** "₹90,000 deposit", or null when there isn't one. */
export function depositLine(p: Pick<Property, 'deposit'>) {
  return p.deposit ? `${rupees(p.deposit)} deposit` : null
}

const IMMEDIATE = /^(?:immediate(?:ly)?|now|ready(?: to move(?: in)?)?)$/i

/** "Available immediately", "Move-in: 1st January" or, on a sale, "Ready to move in" / "Possession: Dec 2026". */
export function availabilityLine(p: Pick<Property, 'moveInDate' | 'listingType'>): string | null {
  const v = p.moveInDate?.trim()
  if (!v) return null
  const rent = p.listingType === 'rent'
  if (IMMEDIATE.test(v)) return rent ? 'Available immediately' : 'Ready to move in'
  return `${rent ? 'Move-in' : 'Possession'}: ${capitalise(v)}`
}

/** The move-in date as a Property details value: "Immediately" (or "Ready to move in" on a sale), else as written. */
export function availabilityValue(p: Pick<Property, 'moveInDate' | 'listingType'>): string | null {
  const v = p.moveInDate?.trim()
  if (!v) return null
  if (IMMEDIATE.test(v)) return p.listingType === 'rent' ? 'Immediately' : 'Ready to move in'
  return capitalise(v)
}

/** "₹8,500/sq ft" on a sale with a price and an area (built-up, else carpet); null otherwise. */
export function pricePerSqftLine(p: Pick<Property, 'price' | 'builtUpArea' | 'carpetArea' | 'listingType'>): string | null {
  const area = p.builtUpArea || p.carpetArea
  if (p.listingType !== 'sale' || !p.price || !area) return null
  return `${rupees(Math.round(p.price / area))}/sq ft`
}

export interface ListingExtra {
  kind: 'balconies' | 'other'
  label: string
  value: string
}

const isMapsLink = (v: unknown) => typeof v === 'string' && MAPS_URL.exec(v.trim())?.[0] === v.trim()

/**
 * Balconies and the extractor's extra details, rental terms first. Leaves out the maintenance charge,
 * which has its own row, and a map link shown as a map.
 */
export function listingExtras(p: Pick<Property, 'balconies' | 'other'>): ListingExtra[] {
  const extras: ListingExtra[] = []
  if (p.balconies != null) extras.push({ kind: 'balconies', label: p.balconies === 1 ? 'Balcony' : 'Balconies', value: p.balconies ? String(p.balconies) : 'None' })
  const ownRow = maintenanceKey(p.other)
  const entries = Object.entries(p.other).sort(([a], [b]) => termRank(a) - termRank(b))
  for (const [key, v] of entries) {
    const value = key === ownRow || isMapsLink(v) ? null : extraValue(v)
    if (value) extras.push({ kind: 'other', label: extraLabel(key), value })
  }
  return extras
}
