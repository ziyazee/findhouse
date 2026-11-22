import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown }, call: null as unknown }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async (fn: string, args: unknown) => {
      db.call = { fn, args }
      return db.result
    },
  },
}))

const { brokerService, SubdomainError } = await import('./BrokerService')

beforeEach(() => {
  db.result = { data: null, error: null }
})

describe('brokerService.getProfile', () => {
  it('looks a broker up by id or by subdomain', async () => {
    db.result = { data: [{ id: 'b1', name: ' Ravi ', phone: '919876543210', subdomain: 'ravi' }], error: null }
    expect(await brokerService.getProfile({ subdomain: 'ravi' })).toEqual({ id: 'b1', name: 'Ravi', phone: '919876543210', subdomain: 'ravi' })
    expect(db.call).toEqual({ fn: 'get_broker_page', args: { page_subdomain: 'ravi' } })
    await brokerService.getProfile({ id: 'b1' })
    expect(db.call).toEqual({ fn: 'get_broker_page', args: { page_broker_id: 'b1' } })
  })

  it('reads no row, or an id that is not a UUID, as not found', async () => {
    db.result = { data: [], error: null }
    expect(await brokerService.getProfile({ id: 'b1' })).toBeNull()
    db.result = { data: null, error: { code: '22P02', message: 'invalid input syntax' } }
    expect(await brokerService.getProfile({ id: 'nope' })).toBeNull()
  })

  it('keeps the id it asked for when the older function leaves it out', async () => {
    db.result = { data: [{ name: null, phone: '91' }], error: null }
    expect(await brokerService.getProfile({ id: 'b1' })).toMatchObject({ id: 'b1', subdomain: null })
  })
})

describe('brokerService.setSubdomain', () => {
  it('explains a taken or reserved name', async () => {
    db.result = { data: null, error: { code: '23505', message: 'duplicate key' } }
    await expect(brokerService.setSubdomain('ravi')).rejects.toThrow(SubdomainError)
    await expect(brokerService.setSubdomain('ravi')).rejects.toThrow(/already has that name/)
    db.result = { data: null, error: { code: '22023', message: 'reserved' } }
    await expect(brokerService.setSubdomain('admin')).rejects.toThrow(/reserved/)
  })

  it('returns the saved name', async () => {
    db.result = { data: 'ravi-homes', error: null }
    expect(await brokerService.setSubdomain('ravi-homes')).toBe('ravi-homes')
  })
})

describe('brokerService.getSite', () => {
  it('returns the broker and their listings from one call', async () => {
    db.result = { data: { id: 'b1', name: ' Ravi ', phone: '919876543210', subdomain: 'ravi', listings: [] }, error: null }
    expect(await brokerService.getSite({ subdomain: 'ravi' })).toEqual({
      profile: { id: 'b1', name: 'Ravi', phone: '919876543210', subdomain: 'ravi' },
      listings: [],
    })
    expect(db.call).toEqual({ fn: 'get_broker_site', args: { page_subdomain: 'ravi' } })
  })

  it('reads no broker, or an id that is not a UUID, as not found', async () => {
    db.result = { data: null, error: null }
    expect(await brokerService.getSite({ id: 'b1' })).toBeNull()
    db.result = { data: null, error: { code: '22P02', message: 'invalid input syntax' } }
    expect(await brokerService.getSite({ id: 'nope' })).toBeNull()
  })
})
