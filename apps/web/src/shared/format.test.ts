import { describe, expect, it } from 'vitest'
import { capitalize, initials, inr, rupeesInWords } from './format'

describe('format', () => {
  it('capitalizes the first letter only', () => {
    expect(capitalize('semi-furnished')).toBe('Semi-furnished')
    expect(capitalize('')).toBe('')
  })

  it('takes up to two initials', () => {
    expect(initials('Ravi Kumar Shah')).toBe('RK')
    expect(initials('broker')).toBe('B')
    expect(initials('  Asha   Rao ')).toBe('AR')
  })

  it('groups rupees the Indian way', () => {
    expect(inr(145000.4)).toBe('₹1,45,000')
    expect(rupeesInWords(99999)).toBe('₹99,999')
    expect(rupeesInWords(150000)).toBe('₹1.5 lakh')
    expect(rupeesInWords(12_345_678)).toBe('₹1.23 crore')
  })
})
