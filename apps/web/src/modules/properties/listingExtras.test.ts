import { describe, expect, it } from 'vitest'
import { makeProperty } from '@/test/fixtures'
import {
  availabilityLine, availabilityValue, depositLine, extraLabel, extraValue, listingExtras, maintenanceLine, maintenanceValue,
  pricePerSqftLine,
} from './listingExtras'

describe('map links in extra details', () => {
  it('leaves a shared Google Maps link out of the detail rows', () => {
    const p = makeProperty({ balconies: null, moveInDate: null, other: { mapLink: 'https://maps.app.goo.gl/AbC123', facing: 'East' } })
    expect(listingExtras(p).map((x) => x.label)).toEqual(['Facing'])
  })
})

describe('extraLabel', () => {
  it('turns the keys the extractor picks into labels', () => {
    expect(extraLabel('maintenanceCharge')).toBe('Maintenance charge')
    expect(extraLabel('water_supply')).toBe('Water supply')
    expect(extraLabel('age of property')).toBe('Age of property')
    expect(extraLabel('FACING-DIRECTION')).toBe('Facing direction')
  })

  it('names the rental terms however the key is written', () => {
    expect(extraLabel('nonVegAllowed')).toBe('Non-veg allowed')
    expect(extraLabel('lock_in_period')).toBe('Lock-in period')
    expect(extraLabel('Preferred Tenants')).toBe('Preferred tenants')
  })
})

describe('maintenanceValue', () => {
  const value = (other: Record<string, unknown>) => maintenanceValue({ other })

  it('gives the charge as a detail value', () => {
    expect(value({ maintenanceCharge: '₹3,500/month' })).toBe('₹3,500/month')
    expect(value({ maintenance: 0 })).toBe('None')
    expect(value({ maintenance: 'included in rent' })).toBe('Included')
    expect(value({ maintenanceIncluded: false })).toBe('Not included')
    expect(value({ maintenance: '₹9,000 per quarter' })).toBe('₹9,000 per quarter')
    expect(value({})).toBeNull()
  })
})

describe('availabilityValue', () => {
  it('gives the move-in date as a detail value', () => {
    expect(availabilityValue({ listingType: 'rent', moveInDate: 'immediate' })).toBe('Immediately')
    expect(availabilityValue({ listingType: 'sale', moveInDate: 'immediate' })).toBe('Ready to move in')
    expect(availabilityValue({ listingType: 'rent', moveInDate: '1st january' })).toBe('1st january')
    expect(availabilityValue({ listingType: 'rent', moveInDate: null })).toBeNull()
  })
})

describe('extraValue', () => {
  it('formats plain values and drops empty ones', () => {
    expect(extraValue(3500)).toBe('3,500')
    expect(extraValue('east facing')).toBe('East facing')
    expect(extraValue(true)).toBe('Yes')
    expect(extraValue(['corporation', 'borewell'])).toBe('Corporation, Borewell')
    expect(extraValue({ amount: 3500, frequency: 'monthly' })).toBe('Amount: 3,500, Frequency: Monthly')
    expect(extraValue('  ')).toBeNull()
    expect(extraValue(null)).toBeNull()
    expect(extraValue([])).toBeNull()
  })
})

describe('maintenanceLine', () => {
  const rent = (other: Record<string, unknown>) => maintenanceLine(makeProperty({ other }))

  it('reads a monthly amount under any maintenance key', () => {
    expect(rent({ maintenanceCharge: 3500 })).toBe('+ ₹3,500 maintenance')
    expect(rent({ 'maintenance charge': '₹3,500/month' })).toBe('+ ₹3,500 maintenance')
    expect(rent({ maintenance_charges: 'Rs. 3500/-' })).toBe('+ ₹3,500 maintenance')
    expect(rent({ Maintenance: '3500 per month' })).toBe('+ ₹3,500 maintenance')
    expect(rent({ maintenance: '2,000 pm' })).toBe('+ ₹2,000 maintenance')
  })

  it('reads the shorthand brokers type', () => {
    expect(rent({ maintenanceCharge: '2k' })).toBe('+ ₹2,000 maintenance')
    expect(rent({ maintenance: '1.5K per month' })).toBe('+ ₹1,500 maintenance')
    expect(rent({ maintenance: 'Rs 3 thousand' })).toBe('+ ₹3,000 maintenance')
    expect(maintenanceValue({ other: { maintenanceCharge: '2k' } })).toBe('₹2,000/month')
  })

  it('reads as monthly on a sale listing', () => {
    expect(maintenanceLine(makeProperty({ listingType: 'sale', other: { maintenance: 4200 } }))).toBe('₹4,200/month maintenance')
  })

  it('shows anything else as written', () => {
    expect(rent({ maintenance: 'included in rent' })).toBe('Maintenance included')
    expect(rent({ maintenance: '₹9,000 per quarter' })).toBe('Maintenance: ₹9,000 per quarter')
    expect(rent({ maintenanceIncluded: true })).toBe('Maintenance included')
    expect(rent({ maintenanceIncluded: false })).toBe('Maintenance not included')
    expect(rent({ maintenance: 0 })).toBe('No maintenance charge')
  })

  it('is null when no maintenance was mentioned', () => {
    expect(rent({})).toBeNull()
    expect(rent({ facing: 'east', maintenance: '' })).toBeNull()
  })
})

describe('depositLine', () => {
  it('formats a deposit and skips a missing one', () => {
    expect(depositLine({ deposit: 90000 })).toBe('₹90,000 deposit')
    expect(depositLine({ deposit: null })).toBeNull()
    expect(depositLine({ deposit: 0 })).toBeNull()
  })
})

describe('availabilityLine', () => {
  it('says when a rental is free and when a sale can be occupied', () => {
    expect(availabilityLine({ listingType: 'rent', moveInDate: 'immediate' })).toBe('Available immediately')
    expect(availabilityLine({ listingType: 'rent', moveInDate: '1st January' })).toBe('Move-in: 1st January')
    expect(availabilityLine({ listingType: 'sale', moveInDate: 'Ready to move' })).toBe('Ready to move in')
    expect(availabilityLine({ listingType: 'sale', moveInDate: 'dec 2026' })).toBe('Possession: Dec 2026')
    expect(availabilityLine({ listingType: 'rent', moveInDate: '  ' })).toBeNull()
  })
})

describe('pricePerSqftLine', () => {
  it('works out the rate on a sale from the built-up area, else the carpet area', () => {
    expect(pricePerSqftLine({ listingType: 'sale', price: 9500000, builtUpArea: 1150, carpetArea: 980 })).toBe('₹8,261/sq ft')
    expect(pricePerSqftLine({ listingType: 'sale', price: 9800000, builtUpArea: null, carpetArea: 980 })).toBe('₹10,000/sq ft')
    expect(pricePerSqftLine({ listingType: 'rent', price: 45000, builtUpArea: 1150, carpetArea: null })).toBeNull()
    expect(pricePerSqftLine({ listingType: 'sale', price: null, builtUpArea: 1150, carpetArea: null })).toBeNull()
  })
})

describe('listingExtras', () => {
  it('lists balconies and the extra details, without the maintenance shown with the price', () => {
    const p = makeProperty({
      balconies: 2,
      moveInDate: 'immediate',
      other: { maintenanceCharge: 3500, facingDirection: 'east', waterSupply: '24 hours', notes: null },
    })
    expect(listingExtras(p)).toEqual([
      { kind: 'balconies', label: 'Balconies', value: '2' },
      { kind: 'other', label: 'Facing direction', value: 'East' },
      { kind: 'other', label: 'Water supply', value: '24 hours' },
    ])
  })

  it('keeps maintenance text it could not place with the price', () => {
    const p = makeProperty({ listingType: 'sale', balconies: 1, other: { maintenanceAvailable: true } })
    expect(listingExtras(p)).toEqual([
      { kind: 'balconies', label: 'Balcony', value: '1' },
      { kind: 'other', label: 'Maintenance available', value: 'Yes' },
    ])
  })

  it('lists the rental terms first, in a fixed order', () => {
    const p = makeProperty({
      balconies: null,
      other: { facing: 'east', brokerage: 'No brokerage', petsAllowed: false, preferredTenants: 'family' },
    })
    expect(listingExtras(p).map((x) => `${x.label}: ${x.value}`)).toEqual([
      'Preferred tenants: Family',
      'Pets allowed: No',
      'Brokerage: No brokerage',
      'Facing: East',
    ])
  })

  it('is empty when the extractor found nothing extra', () => {
    expect(listingExtras(makeProperty())).toEqual([])
  })
})
