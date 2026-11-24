import { MAPS_URL } from '@/modules/properties/listingExtras'
import type { Property, PropertyMedia } from '@/modules/properties/property.types'
import { titleCase } from '@/shared/format'

export { titleCase }

export function photoAlt(m: PropertyMedia, title: string) {
  if (m.mediaType === 'video') return `Video, ${title}`
  return m.category ? `${titleCase(m.category)}, ${title}` : title
}

const UNROOMED = new Set(['COVER', 'OTHER'])

/** The room a photo shows, or null when the classifier didn't name one. */
export function roomLabel(m: PropertyMedia) {
  return m.category && !UNROOMED.has(m.category.toUpperCase()) ? titleCase(m.category) : null
}

export const isVideo = (m: PropertyMedia) => m.mediaType === 'video'

const OTHERS = 'Others'

/** The label a photo or video is grouped under in the gallery. */
export function groupLabel(m: PropertyMedia) {
  return isVideo(m) ? 'Videos' : roomLabel(m) ?? OTHERS
}

const ROOM_ORDER = ['living room', 'bedroom', 'bathroom', 'kitchen', 'balcony', 'exterior']
const roomRank = (room: string) => {
  const i = ROOM_ORDER.indexOf(room.toLowerCase())
  return i >= 0 ? i : room === OTHERS ? ROOM_ORDER.length + 1 : ROOM_ORDER.length
}

/**
 * Everything the gallery shows: photos grouped by room in a fixed order (living room, bedroom, bathroom, kitchen,
 * balcony, exterior, any other named room, then "Others"), then videos. Within a room the cover leads, then the
 * broker's order; other named rooms keep the order of their first photo.
 */
export function galleryMedia(media: PropertyMedia[]) {
  const ordered = [...media].sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.displayOrder - b.displayOrder)
  const rooms = new Map<string, PropertyMedia[]>()
  for (const m of ordered.filter((m) => !isVideo(m))) {
    const room = groupLabel(m)
    rooms.set(room, [...(rooms.get(room) ?? []), m])
  }
  const byRoom = [...rooms].sort(([a], [b]) => roomRank(a) - roomRank(b))
  return [...byRoom.flatMap(([, photos]) => photos), ...ordered.filter(isVideo)]
}

export interface GalleryGroup { label: string; start: number; count: number }

/** Consecutive runs of the same room (or the videos) in gallery order, for jumping between them. */
export function galleryGroups(items: PropertyMedia[]): GalleryGroup[] {
  const groups: GalleryGroup[] = []
  items.forEach((m, i) => {
    const label = groupLabel(m)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.count++
    else groups.push({ label, start: i, count: 1 })
  })
  return groups
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "9 photos", "9 photos · 2 videos" or "1 video". */
export function mediaCount(items: PropertyMedia[]) {
  const videos = items.filter(isVideo).length
  const photos = items.length - videos
  return [photos && plural(photos, 'photo'), videos && plural(videos, 'video')].filter(Boolean).join(' · ')
}

/** Grid tiles to show: the first few in order, with the first video swapped in when it would otherwise be hidden. */
export function gridIndexes(items: PropertyMedia[], max: number) {
  const shown = items.slice(0, max).map((_, i) => i)
  const firstVideo = items.findIndex(isVideo)
  if (firstVideo >= max && max >= 3) shown[max - 2] = firstVideo
  return shown
}

export interface GalleryRow {
  /** Positions in the list given, left to right. */
  items: number[]
  /** Share of the full width the row spans: 1, or less for a short last row so it isn't blown up. */
  span: number
}

/** A last row at least this much wider than tall overall still fills the width without looking blown up. */
const LANDSCAPE = 1.2

/**
 * Rows for a gallery that never crops. Photos in a row share one height and fill the width, each as wide as its
 * shape needs, so a row's height is the width divided by the sum of its aspect ratios (width / height). Rows are
 * filled until that sum is as close to `target` as it gets: a higher target makes shorter rows. A last row under
 * half full joins the row above rather than standing alone as a sliver.
 */
export function justifiedRows(ratios: number[], target: number): GalleryRow[] {
  const rows: { items: number[]; sum: number }[] = []
  let row = { items: [] as number[], sum: 0 }
  const flush = () => {
    if (row.items.length) rows.push(row)
    row = { items: [], sum: 0 }
  }
  ratios.forEach((r, i) => {
    // Adding this photo would overshoot by more than stopping here falls short.
    if (row.items.length && row.sum + r - target > target - row.sum) flush()
    row.items.push(i)
    row.sum += r
    if (row.sum >= target) flush()
  })
  flush()
  const last = rows[rows.length - 1]
  if (rows.length > 1 && last.sum < target / 2) {
    rows.pop()
    const prev = rows[rows.length - 1]
    prev.items.push(...last.items)
    prev.sum += last.sum
  }
  return rows.map((r, i) => ({
    items: r.items,
    span: i === rows.length - 1 && r.sum < target && r.sum < LANDSCAPE ? r.sum / target : 1,
  }))
}

/** Short price for the contact bar, e.g. "₹45,000 / month". */
/** Deposit and maintenance for a rental, with "Confidential" when the broker left them out. */
export function confidentialRentLines(
  p: Pick<Property, 'listingType' | 'deposit' | 'other'>,
  maintenance: string | null,
  deposit: string | null,
): Array<string | null> {
  if (p.listingType !== 'rent') return [maintenance, deposit]
  return [maintenance ?? 'Maintenance: Confidential', deposit ?? 'Deposit: Confidential']
}

export function priceLine(p: Pick<Property, 'price' | 'listingType'>) {
  return p.price ? `₹${p.price.toLocaleString('en-IN')}${p.listingType === 'rent' ? ' / month' : ''}` : 'Price on request'
}

/** "919876543210" → "+91 98765 43210"; other numbers are shown as dialled. */
export function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, '')
  return d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : `+${d}`
}

export function mapsLink(place: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
}

/** The Google Maps link the broker shared, found in the extra details, the location or the description. */
export function sharedMapsLink(p: Pick<Property, 'other' | 'location' | 'locality' | 'description'>): string | null {
  const text = [JSON.stringify(p.other), p.location, p.locality, p.description].filter(Boolean).join(' ')
  return MAPS_URL.exec(text)?.[0].replace(/[.,;)\]]+$/, '') ?? null
}

/** "@12.97,77.64" in a place link, or "q=" / "ll=" / "query=" coordinates. */
const COORDS = /(?:@|[?&](?:q|ll|query|destination)=)(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/
const PLACE_NAME = /\/maps\/place\/([^/@?]+)/

/**
 * An embeddable map for a shared link: its coordinates, else the place it names, else the listing's address.
 * Shortened links (maps.app.goo.gl) can't be read in the browser, so those fall back to the address.
 */
export function mapEmbedUrl(link: string, place: string | null): string | null {
  let decoded = link
  try { decoded = decodeURIComponent(link) } catch { /* keep the raw link */ }
  const coords = COORDS.exec(decoded)
  const name = PLACE_NAME.exec(decoded)?.[1].replace(/\+/g, ' ')
  const query = coords ? `${coords[1]},${coords[2]}` : name ?? place
  return query ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed` : null
}

/** The message a guest sends from the WhatsApp button, with a link back to this page. */
export function enquiryMessage(p: Pick<Property, 'title' | 'locality'>, pageUrl: string) {
  return `Hi, I'm interested in "${p.title}"${p.locality ? ` in ${p.locality}` : ''}. Is it still available?\n${pageUrl}`
}

export function whatsAppLink(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

/** The type to show: as given, else "Residential" for a BHK listing, else null so it isn't shown. */
export function propertyTypeLabel(p: Pick<Property, 'propertyType' | 'bedrooms'>) {
  if (p.propertyType?.trim()) return titleCase(p.propertyType)
  return p.bedrooms != null ? 'Residential' : null
}

/** Written from the details when the broker hasn't added a description. */
export function defaultDescription(p: Property, place: string | null) {
  const size = p.bedrooms != null ? `${p.bedrooms} BHK ` : ''
  const kind = p.propertyType?.trim() ? titleCase(p.propertyType).toLowerCase() : 'home'
  const where = place ? ` in ${place}` : ''
  const furnishing = p.furnishing ? ` It comes ${titleCase(p.furnishing).toLowerCase()}` : ''
  const area = p.builtUpArea ? `${furnishing ? ', with' : ' It offers'} ${p.builtUpArea.toLocaleString('en-IN')} sq ft of living space` : ''
  return `A well-kept ${size}${kind}${where}, available for ${p.listingType === 'rent' ? 'rent' : 'sale'}.${furnishing}${area}${furnishing || area ? '.' : ''} Get in touch to arrange a visit.`
}
