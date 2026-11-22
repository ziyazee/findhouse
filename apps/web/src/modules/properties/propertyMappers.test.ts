import { describe, expect, it } from 'vitest'
import { generateSlug, toProperty, toPropertyRow, type PropertyWithMediaRow } from './propertyMappers'

const row: PropertyWithMediaRow = {
  id: 'p1', broker_id: 'b1', session_id: null, slug: 'two-bhk-x1', short_id: 'k3f9x2ab', title: '2BHK', property_type: 'apartment',
  listing_type: 'rent', status: 'available', price: 45000, deposit: null, location: 'Bandra', locality: 'Bandra',
  bedrooms: 2, bathrooms: 1, balconies: null, built_up_area: 900, carpet_area: null, furnishing: null, floor: null,
  total_floors: null, parking: null, move_in_date: null, amenities: null, description: null, other: null,
  raw_data: null, cover_image_id: null, image_classification_status: null, image_classification_metadata: null, is_public: false,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  property_media: [{
    id: 'm1', property_id: 'p1', media_type: 'image', storage_path: 'submissions/s1/a.jpg', category: 'BEDROOM',
    ai_description: null, ai_confidence: null, display_order: 0, is_cover: true, created_at: '2026-01-01T00:00:00Z',
  }],
}

describe('toProperty', () => {
  it('maps a row and its media to the domain model', () => {
    const p = toProperty(row)
    expect(p).toMatchObject({ id: 'p1', brokerId: 'b1', listingType: 'rent', status: 'available', builtUpArea: 900, amenities: [] })
    expect(p.media).toEqual([expect.objectContaining({ storagePath: 'submissions/s1/a.jpg', isCover: true, mediaType: 'image' })])
  })

  it('never reads an unknown status as live', () => {
    expect(toProperty({ ...row, status: 'archived' }).status).toBe('sold')
  })

  it('reads the visibility flag, treating a missing column as private', () => {
    expect(toProperty({ ...row, is_public: true }).isPublic).toBe(true)
    expect(toProperty(row).isPublic).toBe(false)
    expect(toProperty({ ...row, is_public: undefined as unknown as boolean }).isPublic).toBe(false)
  })

  it('tolerates a missing media relation', () => {
    expect(toProperty({ ...row, property_media: null }).media).toEqual([])
  })

  it('keeps the extracted extras, reading anything but an object as none', () => {
    const p = toProperty({ ...row, deposit: 90000, balconies: 1, move_in_date: 'immediate', other: { maintenanceCharge: 3500 } })
    expect(p).toMatchObject({ deposit: 90000, balconies: 1, moveInDate: 'immediate', other: { maintenanceCharge: 3500 } })
    expect(toProperty(row).other).toEqual({})
    expect(toProperty({ ...row, other: ['x'] as unknown as Record<string, unknown> }).other).toEqual({})
  })
})

describe('toPropertyRow', () => {
  it('keeps null so a cleared field is cleared, and leaves omitted fields undefined', () => {
    const r = toPropertyRow({ price: null, description: null, title: 'New' })
    expect(r.price).toBeNull()
    expect(r.description).toBeNull()
    expect(r.title).toBe('New')
    expect(JSON.parse(JSON.stringify(r))).toEqual({ price: null, description: null, title: 'New' })
  })
})

describe('generateSlug', () => {
  it('builds a url-safe slug with a random suffix', () => {
    expect(generateSlug('Sea-facing 3BHK, Bandra West!', () => 0.123456789)).toBe('sea-facing-3bhk-bandra-west-4fzzzx')
  })
})
