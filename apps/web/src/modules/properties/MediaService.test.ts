import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeMedia } from '@/test/fixtures'

const db = vi.hoisted(() => ({
  inserts: [] as Record<string, unknown>[],
  insertError: null as null | { message: string },
  calls: [] as string[],
}))
const storage = vi.hoisted(() => ({ uploadObject: vi.fn(), deleteObject: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        db.inserts.push(row)
        return { error: db.insertError }
      },
      update: (patch: { is_cover?: boolean; category?: string }) => ({
        eq: (_col: string, value: string) => {
          db.calls.push(`${'category' in patch ? `category=${patch.category}` : `cover=${patch.is_cover}`} eq ${value}`)
          return Object.assign(Promise.resolve({ error: null }), {
            neq: async (_c: string, v: string) => {
              db.calls.push(`  neq ${v}`)
              return { error: null }
            },
          })
        },
      }),
      delete: () => ({
        eq: async (_col: string, value: string) => {
          db.calls.push(`delete ${value}`)
          return { error: null }
        },
      }),
    }),
  },
}))

vi.mock('@/lib/storage', async (load) => ({ ...(await load<typeof import('@/lib/storage')>()), ...storage }))

const { mediaService } = await import('./MediaService')

const PROPERTY = '11111111-2222-3333-4444-555555555555'
const file = (name: string, type: string, size = 1000) => ({ name, type, size }) as File

beforeEach(() => {
  db.inserts = []
  db.insertError = null
  db.calls = []
  storage.uploadObject.mockReset().mockResolvedValue(undefined)
  storage.deleteObject.mockReset().mockResolvedValue(undefined)
})

describe('mediaService.upload', () => {
  it('appends files in order and makes only the first photo the cover', async () => {
    const result = await mediaService.upload(PROPERTY, [file('a.mp4', 'video/mp4'), file('b.jpg', 'image/jpeg'), file('c.png', 'image/png')], [])

    expect(result).toEqual({ uploaded: 3, failures: [] })
    expect(db.inserts.map((r) => [r.media_type, r.display_order, r.is_cover])).toEqual([
      ['video', 0, false],
      ['image', 1, true],
      ['image', 2, false],
    ])
    expect(db.inserts.every((r) => String(r.storage_path).startsWith(`properties/${PROPERTY}/`))).toBe(true)
  })

  it('continues after existing media and keeps the existing cover', async () => {
    const existing = [makeMedia({ displayOrder: 0, isCover: true }), makeMedia({ id: 'm2', displayOrder: 4 })]
    await mediaService.upload(PROPERTY, [file('d.jpg', 'image/jpeg')], existing)
    expect(db.inserts[0]).toMatchObject({ display_order: 5, is_cover: false })
  })

  it('skips unsupported and oversized files with a reason', async () => {
    const result = await mediaService.upload(PROPERTY, [file('notes.pdf', 'application/pdf'), file('big.mov', 'video/quicktime', 60 * 1024 * 1024)], [])
    expect(result.uploaded).toBe(0)
    expect(result.failures).toHaveLength(2)
    expect(storage.uploadObject).not.toHaveBeenCalled()
  })

  it('removes the uploaded file when the database row cannot be saved', async () => {
    db.insertError = { message: 'permission denied' }
    const result = await mediaService.upload(PROPERTY, [file('a.jpg', 'image/jpeg')], [])
    expect(result.failures[0]).toContain('permission denied')
    expect(storage.deleteObject).toHaveBeenCalledWith(storage.uploadObject.mock.calls[0][0])
  })
})

describe('mediaService.setCover', () => {
  it('marks the new cover before clearing the others', async () => {
    await mediaService.setCover(PROPERTY, 'm9')
    expect(db.calls).toEqual(['cover=true eq m9', `cover=false eq ${PROPERTY}`, '  neq m9'])
  })
})

describe('mediaService.setCategory', () => {
  it('updates only that photo', async () => {
    await mediaService.setCategory('m3', 'KITCHEN')
    expect(db.calls).toEqual(['category=KITCHEN eq m3'])
  })
})

describe('mediaService.remove', () => {
  it('deletes dashboard uploads from storage', async () => {
    await mediaService.remove(makeMedia({ id: 'm1', storagePath: `properties/${PROPERTY}/1-abc.jpg` }))
    expect(db.calls).toEqual(['delete m1'])
    expect(storage.deleteObject).toHaveBeenCalledWith(`properties/${PROPERTY}/1-abc.jpg`)
  })

  it('keeps WhatsApp media, which the original message still uses', async () => {
    await mediaService.remove(makeMedia({ id: 'm2', storagePath: 'submissions/s1/wamid.jpg' }))
    expect(db.calls).toEqual(['delete m2'])
    expect(storage.deleteObject).not.toHaveBeenCalled()
  })
})
