import { describe, expect, it } from 'vitest'
import { isAllowedKey, isAllowedType, propertyIdOf } from './upload'

const id = '3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b'

describe('upload key rules', () => {
  it('finds the property a key belongs to', () => {
    expect(propertyIdOf(`properties/${id}/1732000000000-ab12cd34.jpg`)).toBe(id)
  })

  it('accepts dashboard uploads for a property', () => {
    expect(isAllowedKey(`properties/${id}/1732000000000-ab12cd34.jpg`)).toBe(true)
  })

  it('refuses WhatsApp media, which the original messages still use', () => {
    expect(isAllowedKey(`submissions/${id}/wamid.HBgM.jpg`)).toBe(false)
  })

  it('refuses traversal, nesting and missing keys', () => {
    expect(isAllowedKey(`properties/${id}/../../submissions/x.jpg`)).toBe(false)
    expect(isAllowedKey(`properties/${id}/a/b.jpg`)).toBe(false)
    expect(isAllowedKey('properties/not-a-uuid/a.jpg')).toBe(false)
    expect(isAllowedKey('')).toBe(false)
    expect(isAllowedKey(null)).toBe(false)
  })

  it('only takes photos and videos', () => {
    expect(isAllowedType('image/jpeg')).toBe(true)
    expect(isAllowedType('video/mp4')).toBe(true)
    expect(isAllowedType('text/html')).toBe(false)
    expect(isAllowedType('')).toBe(false)
  })
})
