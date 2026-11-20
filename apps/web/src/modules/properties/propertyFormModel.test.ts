import { describe, expect, it } from 'vitest'
import { makeProperty } from '@/test/fixtures'
import { extrasProblem, maintenanceHint, priceHint, suggestTitle, toFormState, toPropertyInput } from './propertyFormModel'

describe('toFormState / toPropertyInput', () => {
  it('round-trips a saved property', () => {
    const p = makeProperty({ bedrooms: 2, bathrooms: 2, floor: '5', amenities: ['Gym'] })
    const input = toPropertyInput(toFormState(p), p.title)
    expect(input).toMatchObject({
      title: p.title, price: 45000, locality: 'Bandra West', bedrooms: 2, bathrooms: 2, floor: '5', amenities: ['Gym'],
    })
  })

  it('sends null for cleared fields so edits can remove a value', () => {
    const form = { ...toFormState(makeProperty({ bedrooms: 3, description: 'Sea view' })), bedrooms: '', description: '   ', price: '' }
    const input = toPropertyInput(form, 'T')
    expect(input.bedrooms).toBeNull()
    expect(input.description).toBeNull()
    expect(input.price).toBeNull()
  })

  it('trims text and starts a new form with sensible defaults', () => {
    const form = { ...toFormState(), locality: '  Juhu  ' }
    expect(form.propertyType).toBe('apartment')
    expect(form.listingType).toBe('rent')
    expect(toPropertyInput(form, 'T').locality).toBe('Juhu')
  })
})

describe('extra details', () => {
  const extracted = makeProperty({
    deposit: 135000,
    balconies: 1,
    moveInDate: 'immediate',
    other: { 'maintenance charge': '₹3,500/month', facingDirection: 'west', ageYears: 5, lift: true },
  })

  it('splits maintenance out of the extras and shows the rest as editable rows', () => {
    const form = toFormState(extracted)
    expect(form).toMatchObject({ deposit: '135000', balconies: '1', moveInDate: 'immediate', maintenance: '₹3,500/month' })
    expect(form.extras.map((r) => [r.label, r.value])).toEqual([['Facing direction', 'West'], ['Age years', '5'], ['Lift', 'Yes']])
  })

  it('writes untouched details back exactly as they were stored', () => {
    const input = toPropertyInput(toFormState(extracted), 'T')
    expect(input).toMatchObject({ deposit: 135000, balconies: 1, moveInDate: 'immediate' })
    expect(input.other).toEqual(extracted.other)
  })

  it('saves edited, added and removed details under the labels the broker typed', () => {
    const form = toFormState(extracted)
    form.maintenance = '4000'
    form.extras = [
      { ...form.extras[0], value: 'North' },
      form.extras[2],
      { id: 'new-1', label: 'Water supply', value: '24 hours' },
      { id: 'new-2', label: '  ', value: '' },
    ]
    expect(toPropertyInput(form, 'T').other).toEqual({ maintenance: 4000, 'Facing direction': 'North', lift: true, 'Water supply': '24 hours' })
  })

  it('keeps typed maintenance text and drops cleared maintenance', () => {
    const form = { ...toFormState(extracted), maintenance: 'Included in rent' }
    expect(toPropertyInput(form, 'T').other).toMatchObject({ maintenance: 'Included in rent' })
    const cleared = toPropertyInput({ ...form, maintenance: '' }, 'T').other ?? {}
    expect(Object.keys(cleared).some((k) => /mainten/i.test(k))).toBe(false)
  })

  it('starts a new property with no extras', () => {
    expect(toPropertyInput(toFormState(), 'T').other).toEqual({})
  })

  it('asks for both a name and a value on each row', () => {
    expect(extrasProblem([{ id: 'a', label: 'Facing', value: '' }])).not.toBe('')
    expect(extrasProblem([{ id: 'a', label: '', value: '' }, { id: 'b', label: 'Facing', value: 'East' }])).toBe('')
  })

  it('reads the maintenance amount back as a hint', () => {
    expect(maintenanceHint('3500')).toBe('₹3,500 per month')
    expect(maintenanceHint('Included')).toBeUndefined()
  })
})

describe('suggestTitle', () => {
  it('writes a title from bedrooms, type and locality', () => {
    expect(suggestTitle('2', 'apartment', ' Bandra West ')).toBe('2BHK Apartment in Bandra West')
    expect(suggestTitle('', 'villa', 'Alibaug')).toBe('Villa in Alibaug')
    expect(suggestTitle('3', 'plot', '')).toBe('Plot')
  })

  it('stays empty without bedrooms or locality', () => {
    expect(suggestTitle('', 'house', '  ')).toBe('')
  })
})

describe('priceHint', () => {
  it('reads large amounts in lakh and crore', () => {
    expect(priceHint('8500000', false)).toBe('₹85 lakh')
    expect(priceHint('25000000', false)).toBe('₹2.5 crore')
    expect(priceHint('45000', true)).toBe('₹45,000 per month')
  })

  it('hides for empty or invalid input', () => {
    expect(priceHint('', true)).toBeUndefined()
    expect(priceHint('0', true)).toBeUndefined()
  })
})
