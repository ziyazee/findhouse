import { describe, expect, it } from 'vitest'
import { ROOM_CATEGORIES, roomChoices, roomName, toRoomCategory } from './mediaRooms'

describe('roomName', () => {
  it('names tagged rooms and treats untagged and cover-only photos as having none', () => {
    expect(roomName('LIVING_ROOM')).toBe('Living room')
    expect(roomName('POOJA_ROOM')).toBe('Pooja room')
    expect(roomName('OTHER')).toBe('Other')
    expect(roomName('COVER')).toBeNull()
    expect(roomName(null)).toBeNull()
  })
})

describe('toRoomCategory', () => {
  it('stores a typed name the way the classifier tags rooms', () => {
    expect(toRoomCategory('  Pooja room ')).toBe('POOJA_ROOM')
    expect(toRoomCategory('living room')).toBe('LIVING_ROOM')
    expect(toRoomCategory("Kids' bedroom #2")).toBe('KIDS_BEDROOM_2')
    expect(toRoomCategory('पूजा घर')).toBe('पूजा_घर')
  })

  it('rejects empty, unusable and reserved names', () => {
    expect(toRoomCategory('   ')).toBeNull()
    expect(toRoomCategory('!!!')).toBeNull()
    expect(toRoomCategory('cover')).toBeNull()
  })

  it('caps the length', () => {
    expect(toRoomCategory('a'.repeat(80))).toHaveLength(30)
  })
})

describe('roomChoices', () => {
  it('offers the classifier rooms, plus a custom room the photo already has', () => {
    expect(roomChoices(null)).toEqual(ROOM_CATEGORIES)
    expect(roomChoices('KITCHEN')).toEqual(ROOM_CATEGORIES)
    expect(roomChoices('COVER')).toEqual(ROOM_CATEGORIES)
    expect(roomChoices('STUDY')).toEqual([...ROOM_CATEGORIES.slice(0, -1), 'STUDY', 'OTHER'])
  })
})
