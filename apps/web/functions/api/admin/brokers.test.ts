import { describe, expect, it } from 'vitest'
import { isAuthorized, parseNewNumber, toAdminBroker, type BrokerRow } from './brokers'

describe('isAuthorized', () => {
  it('accepts only the exact secret', async () => {
    expect(await isAuthorized('Bearer s3cret', 's3cret')).toBe(true)
    expect(await isAuthorized('Bearer s3cret ', 's3cret')).toBe(false)
    expect(await isAuthorized('Bearer nope', 's3cret')).toBe(false)
    expect(await isAuthorized('s3cret', 's3cret')).toBe(false)
    expect(await isAuthorized(null, 's3cret')).toBe(false)
  })

  it('refuses everything when no secret is configured', async () => {
    expect(await isAuthorized('Bearer ', undefined)).toBe(false)
    expect(await isAuthorized('Bearer anything', '')).toBe(false)
  })
})

describe('parseNewNumber', () => {
  it('stores numbers the way brokers are looked up', () => {
    expect(parseNewNumber({ phone: '+91 98765-43210' })).toBe('919876543210')
    expect(parseNewNumber({ phone: '09876543210' })).toBe('919876543210')
  })

  it.each([{ phone: '12345' }, { phone: '' }, {}, null, { phone: 9876543210 }])('rejects %j', (body) => {
    expect(parseNewNumber(body)).toBeNull()
  })
})

describe('toAdminBroker', () => {
  const row: BrokerRow = {
    id: 'b1', phone: '919876543210', name: ' Rubbing ', subdomain: 'rubbing', status: 'ACTIVE', plan: 'trial',
    created_at: '2026-11-23T00:00:00Z', broker_credentials: null,
  }

  it('marks a broker registered once they have a password', () => {
    expect(toAdminBroker(row).registered).toBe(false)
    expect(toAdminBroker({ ...row, broker_credentials: { broker_id: 'b1' } }).registered).toBe(true)
    expect(toAdminBroker({ ...row, broker_credentials: [{ broker_id: 'b1' }] }).registered).toBe(true)
    expect(toAdminBroker({ ...row, broker_credentials: [] }).registered).toBe(false)
  })

  it('trims the name and leaves it empty when there is none', () => {
    expect(toAdminBroker(row).name).toBe('Rubbing')
    expect(toAdminBroker({ ...row, name: '  ' }).name).toBeNull()
  })
})
