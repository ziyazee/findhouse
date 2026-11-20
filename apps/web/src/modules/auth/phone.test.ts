import { describe, expect, it } from 'vitest'
import { isIndianMobile, normalizePhone } from './phone'

describe('normalizePhone', () => {
  it.each([
    ['9876543210', '919876543210'],
    ['98765 43210', '919876543210'],
    ['+91 98765-43210', '919876543210'],
    ['919876543210', '919876543210'],
    ['09876543210', '919876543210'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })
})

describe('isIndianMobile', () => {
  it('accepts 10-digit numbers with or without the country code', () => {
    expect(isIndianMobile('9876543210')).toBe(true)
    expect(isIndianMobile('+91 98765 43210')).toBe(true)
  })

  it('rejects short, long and foreign numbers', () => {
    expect(isIndianMobile('98765')).toBe(false)
    expect(isIndianMobile('98765432101')).toBe(false)
    expect(isIndianMobile('+1 415 555 0100')).toBe(false)
  })
})
