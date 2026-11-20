import { describe, expect, it } from 'vitest'
import { makeMedia, makeProperty } from '@/test/fixtures'
import {
  defaultDescription, enquiryMessage, formatPhone, galleryGroups, galleryMedia, gridIndexes, justifiedRows, mapEmbedUrl, mapsLink, mediaCount, photoAlt,
  priceLine, propertyTypeLabel, roomLabel, sharedMapsLink, titleCase, whatsAppLink,
} from './listingContent'

describe('shared map links', () => {
  it('finds a Google Maps link in the extra details, location or description', () => {
    expect(sharedMapsLink(makeProperty({ other: { mapLink: 'https://maps.app.goo.gl/AbC123' } }))).toBe('https://maps.app.goo.gl/AbC123')
    expect(sharedMapsLink(makeProperty({ other: {}, description: 'See https://www.google.com/maps/place/X/@12.97,77.64,17z.' })))
      .toBe('https://www.google.com/maps/place/X/@12.97,77.64,17z')
    expect(sharedMapsLink(makeProperty({ other: {}, description: 'No link here', location: 'Bengaluru' }))).toBeNull()
  })

  it('centres the map on the link’s coordinates, then its place name, then the address', () => {
    expect(mapEmbedUrl('https://www.google.com/maps/place/Home/@12.9716,77.6412,17z', 'Indiranagar'))
      .toBe('https://maps.google.com/maps?q=12.9716%2C77.6412&z=15&output=embed')
    expect(mapEmbedUrl('https://maps.google.com/?q=12.9,77.6', null)).toContain('q=12.9%2C77.6')
    expect(mapEmbedUrl('https://www.google.com/maps/place/Prestige+Tower', null)).toContain('q=Prestige%20Tower')
    expect(mapEmbedUrl('https://maps.app.goo.gl/AbC123', 'Indiranagar, Bengaluru')).toContain('q=Indiranagar%2C%20Bengaluru')
    expect(mapEmbedUrl('https://maps.app.goo.gl/AbC123', null)).toBeNull()
  })
})

describe('listingContent', () => {
  it('titleCases enum-style values', () => {
    expect(titleCase('LIVING_ROOM')).toBe('Living room')
    expect(titleCase('semi-furnished')).toBe('Semi-furnished')
  })

  it('labels photos by room when classified', () => {
    expect(photoAlt(makeMedia({ category: 'KITCHEN' }), 'Sea view flat')).toBe('Kitchen, Sea view flat')
    expect(photoAlt(makeMedia({ category: null }), 'Sea view flat')).toBe('Sea view flat')
  })

  it('puts the cover first, keeps the broker order and puts videos last', () => {
    const media = [
      makeMedia({ id: 'a', displayOrder: 0 }),
      makeMedia({ id: 'v', displayOrder: 1, mediaType: 'video' }),
      makeMedia({ id: 'c', displayOrder: 3, isCover: true }),
      makeMedia({ id: 'b', displayOrder: 2 }),
      makeMedia({ id: 'w', displayOrder: 4, mediaType: 'video', isCover: true }),
    ]
    const items = galleryMedia(media)
    expect(items.map((m) => m.id)).toEqual(['c', 'a', 'b', 'w', 'v'])
    expect(galleryGroups(items)).toEqual([
      { label: 'Others', start: 0, count: 3 },
      { label: 'Videos', start: 3, count: 2 },
    ])
    expect(photoAlt(items[3], 'Sea view flat')).toBe('Video, Sea view flat')
  })

  it('counts photos and videos for labels', () => {
    expect(mediaCount([makeMedia(), makeMedia()])).toBe('2 photos')
    expect(mediaCount([makeMedia(), makeMedia({ mediaType: 'video' })])).toBe('1 photo · 1 video')
    expect(mediaCount([makeMedia({ mediaType: 'video' }), makeMedia({ mediaType: 'video' })])).toBe('2 videos')
  })

  it('swaps the first video into the grid when it would be hidden', () => {
    const photos = Array.from({ length: 7 }, (_, i) => makeMedia({ id: `p${i}` }))
    const video = makeMedia({ id: 'v', mediaType: 'video' })
    expect(gridIndexes([...photos, video], 5)).toEqual([0, 1, 2, 7, 4])
    expect(gridIndexes([...photos.slice(0, 3), video], 5)).toEqual([0, 1, 2, 3])
    expect(gridIndexes(photos, 5)).toEqual([0, 1, 2, 3, 4])
  })

  it('keeps each room together, in a fixed room order with the cover leading its room', () => {
    const media = [
      makeMedia({ id: 'bed1', displayOrder: 0, category: 'BEDROOM' }),
      makeMedia({ id: 'kit1', displayOrder: 1, category: 'KITCHEN' }),
      makeMedia({ id: 'bed2', displayOrder: 2, category: 'BEDROOM' }),
      makeMedia({ id: 'odd', displayOrder: 3, category: 'OTHER' }),
      makeMedia({ id: 'kit2', displayOrder: 4, category: 'KITCHEN', isCover: true }),
      makeMedia({ id: 'new', displayOrder: 5, category: null }),
      makeMedia({ id: 'park', displayOrder: 6, category: 'PARKING' }),
      makeMedia({ id: 'ext', displayOrder: 7, category: 'EXTERIOR' }),
      makeMedia({ id: 'bal', displayOrder: 8, category: 'BALCONY' }),
      makeMedia({ id: 'bath', displayOrder: 9, category: 'BATHROOM' }),
      makeMedia({ id: 'liv', displayOrder: 10, category: 'LIVING_ROOM' }),
    ]
    const photos = galleryMedia(media)
    expect(photos.map((m) => m.id)).toEqual(['liv', 'bed1', 'bed2', 'bath', 'kit2', 'kit1', 'bal', 'ext', 'park', 'odd', 'new'])
    expect(galleryGroups(photos).map((g) => g.label)).toEqual([
      'Living room', 'Bedroom', 'Bathroom', 'Kitchen', 'Balcony', 'Exterior', 'Parking', 'Others',
    ])
  })

  it('fills rows with whole photos, pairing landscapes and grouping portraits in threes', () => {
    const items = (rows: { items: number[] }[]) => rows.map((r) => r.items)
    expect(items(justifiedRows([4 / 3, 4 / 3, 4 / 3, 4 / 3], 2))).toEqual([[0, 1], [2, 3]])
    expect(items(justifiedRows([0.75, 0.75, 0.75], 2))).toEqual([[0, 1, 2]])
    // A wide panorama already fills a row.
    expect(items(justifiedRows([2.5, 4 / 3, 4 / 3], 2))).toEqual([[0], [1, 2]])
  })

  it('puts a landscape and a portrait side by side', () => {
    expect(justifiedRows([4 / 3, 9 / 16], 2)).toEqual([{ items: [0, 1], span: 1 }])
  })

  it('folds a sliver of a last row into the row above', () => {
    expect(justifiedRows([4 / 3, 4 / 3, 0.75], 2)).toEqual([{ items: [0, 1, 2], span: 1 }])
  })

  it('keeps a short last row at the usual height unless it is landscape-shaped', () => {
    expect(justifiedRows([4 / 3, 4 / 3, 1], 2)).toEqual([
      { items: [0, 1], span: 1 },
      { items: [2], span: 0.5 },
    ])
    expect(justifiedRows([4 / 3, 4 / 3, 4 / 3], 2)).toEqual([
      { items: [0, 1], span: 1 },
      { items: [2], span: 1 },
    ])
    expect(justifiedRows([4 / 3], 2)).toEqual([{ items: [0], span: 1 }])
    expect(justifiedRows([0.75], 2)).toEqual([{ items: [0], span: 0.375 }])
  })

  it('names rooms only for real rooms', () => {
    expect(roomLabel(makeMedia({ category: 'LIVING_ROOM' }))).toBe('Living room')
    expect(roomLabel(makeMedia({ category: 'COVER' }))).toBeNull()
    expect(roomLabel(makeMedia({ category: 'OTHER' }))).toBeNull()
    expect(roomLabel(makeMedia({ category: null }))).toBeNull()
  })

  it('formats price and phone for guests', () => {
    expect(priceLine({ price: 45000, listingType: 'rent' })).toBe('₹45,000 / month')
    expect(priceLine({ price: 8_500_000, listingType: 'sale' })).toBe('₹85,00,000')
    expect(priceLine({ price: null, listingType: 'rent' })).toBe('Price on request')
    expect(formatPhone('919876543210')).toBe('+91 98765 43210')
    expect(formatPhone('14155550100')).toBe('+14155550100')
  })

  it('builds the WhatsApp enquiry and maps links', () => {
    const msg = enquiryMessage({ title: '2BHK', locality: 'Juhu' }, 'https://x.test/p/a')
    expect(msg).toBe('Hi, I\'m interested in "2BHK" in Juhu. Is it still available?\nhttps://x.test/p/a')
    expect(whatsAppLink('919876543210', 'Hi & bye')).toBe('https://wa.me/919876543210?text=Hi%20%26%20bye')
    expect(mapsLink('Bandra West, Mumbai')).toBe('https://www.google.com/maps/search/?api=1&query=Bandra%20West%2C%20Mumbai')
  })

  it('writes a fallback description from the details', () => {
    const p = makeProperty({ bedrooms: 2, propertyType: 'apartment', furnishing: 'furnished', builtUpArea: 1200 })
    expect(defaultDescription(p, 'Bandra West')).toBe(
      'A well-kept 2 BHK apartment in Bandra West, available for rent. It comes furnished, with 1,200 sq ft of living space. Get in touch to arrange a visit.',
    )
    expect(defaultDescription(makeProperty({ bedrooms: null, furnishing: null, builtUpArea: null, listingType: 'sale' }), null))
      .toBe('A well-kept apartment, available for sale. Get in touch to arrange a visit.')
    expect(defaultDescription(makeProperty({ bedrooms: 3, propertyType: '', furnishing: null, builtUpArea: null }), null))
      .toBe('A well-kept 3 BHK home, available for rent. Get in touch to arrange a visit.')
  })

  it('shows a property type only when there is one to show', () => {
    expect(propertyTypeLabel({ propertyType: 'apartment', bedrooms: 2 })).toBe('Apartment')
    expect(propertyTypeLabel({ propertyType: '', bedrooms: 3 })).toBe('Residential')
    expect(propertyTypeLabel({ propertyType: '  ', bedrooms: null })).toBeNull()
  })
})
