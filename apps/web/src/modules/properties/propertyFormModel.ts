import { capitalize, rupeesInWords } from '@/shared/format'
import { extraLabel, extraValue, maintenanceKey, monthlyAmount } from './listingExtras'
import type { CreatePropertyInput, ListingType, Property } from './property.types'

/** One "other detail" row. `saved` is the stored key and value, written back unchanged while the row is unedited. */
export interface ExtraRow {
  id: string
  label: string
  value: string
  saved?: { key: string; value: unknown }
}

/** What the property form edits. Numbers stay as typed text until submit. */
export interface PropertyFormState {
  title: string
  propertyType: string
  listingType: ListingType
  price: string
  deposit: string
  maintenance: string
  location: string
  locality: string
  bedrooms: string
  bathrooms: string
  balconies: string
  builtUpArea: string
  carpetArea: string
  furnishing: string
  floor: string
  totalFloors: string
  parking: string
  moveInDate: string
  amenities: string[]
  description: string
  extras: ExtraRow[]
  /** The maintenance entry as stored, kept as-is while the field is unedited. */
  savedMaintenance?: { key: string; value: unknown }
}

export function toFormState(p?: Partial<Property>): PropertyFormState {
  const other = p?.other ?? {}
  const mKey = maintenanceKey(other)
  return {
    title: p?.title ?? '',
    propertyType: p?.propertyType ?? 'apartment',
    listingType: p?.listingType ?? 'rent',
    price: p?.price?.toString() ?? '',
    deposit: p?.deposit?.toString() ?? '',
    maintenance: mKey ? maintenanceText(other[mKey]) : '',
    location: p?.location ?? '',
    locality: p?.locality ?? '',
    bedrooms: p?.bedrooms?.toString() ?? '',
    bathrooms: p?.bathrooms?.toString() ?? '',
    balconies: p?.balconies?.toString() ?? '',
    builtUpArea: p?.builtUpArea?.toString() ?? '',
    carpetArea: p?.carpetArea?.toString() ?? '',
    furnishing: p?.furnishing ?? '',
    floor: p?.floor ?? '',
    totalFloors: p?.totalFloors?.toString() ?? '',
    parking: p?.parking ?? '',
    moveInDate: p?.moveInDate ?? '',
    amenities: p?.amenities ?? [],
    description: p?.description ?? '',
    extras: Object.entries(other).flatMap(([key, value], i) => {
      const text = key === mKey ? null : extraValue(value)
      return text ? [{ id: `saved-${i}`, label: extraLabel(key), value: text, saved: { key, value } }] : []
    }),
    savedMaintenance: mKey ? { key: mKey, value: other[mKey] } : undefined,
  }
}

/** Empty fields are sent as null, so clearing a field while editing actually clears it. */
export function toPropertyInput(form: PropertyFormState, title: string): CreatePropertyInput {
  return {
    title,
    propertyType: form.propertyType,
    listingType: form.listingType,
    price: toNumber(form.price),
    deposit: toNumber(form.deposit),
    location: toText(form.location),
    locality: toText(form.locality),
    bedrooms: toNumber(form.bedrooms),
    bathrooms: toNumber(form.bathrooms),
    balconies: toNumber(form.balconies),
    builtUpArea: toNumber(form.builtUpArea),
    carpetArea: toNumber(form.carpetArea),
    furnishing: toText(form.furnishing),
    floor: toText(form.floor),
    totalFloors: toNumber(form.totalFloors),
    parking: toText(form.parking),
    moveInDate: toText(form.moveInDate),
    amenities: form.amenities,
    description: toText(form.description),
    other: toOther(form),
  }
}

/** The extra details to store: maintenance first, then each filled row under its label. */
function toOther(form: PropertyFormState) {
  const other: Record<string, unknown> = {}
  const maintenance = form.maintenance.trim()
  const saved = form.savedMaintenance
  if (saved && maintenance === maintenanceText(saved.value)) other[saved.key] = saved.value
  else if (maintenance) other.maintenance = monthlyAmount(maintenance) ?? maintenance
  for (const row of form.extras) {
    const label = row.label.trim()
    const value = row.value.trim()
    if (!label || !value) continue
    const s = row.saved
    if (s && label === extraLabel(s.key) && value === extraValue(s.value)) other[s.key] = s.value
    else other[label] = value
  }
  return other
}

/** A stored maintenance value as the broker would type it: "3500", "Included", "₹9,000 per quarter". */
function maintenanceText(v: unknown) {
  if (typeof v === 'boolean') return v ? 'Included' : 'Not included'
  return typeof v === 'number' ? String(v) : extraValue(v) ?? ''
}

/** Why the form can't be saved yet because of the other-details rows, if it can't. */
export function extrasProblem(rows: ExtraRow[]) {
  return rows.some((r) => !r.label.trim() !== !r.value.trim())
    ? 'Each extra detail needs both a name and a value. Clear both to remove one.'
    : ''
}

/** Hint under the maintenance field, e.g. "₹3,500 per month". */
export function maintenanceHint(raw: string) {
  const amount = monthlyAmount(raw.trim())
  return amount ? `₹${amount.toLocaleString('en-IN')} per month` : undefined
}

/** A title written from the details, e.g. "2BHK Apartment in Bandra West". Empty when there's too little to go on. */
export function suggestTitle(bedrooms: string, propertyType: string, locality: string) {
  const place = locality.trim()
  if (!bedrooms && !place) return ''
  const type = capitalize(propertyType)
  const head = bedrooms && propertyType !== 'plot' && propertyType !== 'commercial' ? `${bedrooms}BHK ${type}` : type
  return place ? `${head} in ${place}` : head
}

/** Hint under the price field, e.g. "₹85 lakh" or "₹45,000 per month". */
export function priceHint(raw: string, isRent: boolean) {
  const n = Number(raw)
  if (!raw || !Number.isFinite(n) || n <= 0) return undefined
  const text = rupeesInWords(n)
  return isRent ? `${text} per month` : text
}

function toText(s: string) {
  return s.trim() || null
}

function toNumber(s: string) {
  if (!s.trim()) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
