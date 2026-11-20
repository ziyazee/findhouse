import { titleCase } from '@/shared/format'

/** The rooms the photo classifier tags, in the order the room picker offers them. */
export const ROOM_CATEGORIES = [
  'LIVING_ROOM', 'BEDROOM', 'KITCHEN', 'BATHROOM', 'BALCONY', 'EXTERIOR', 'FLOOR_PLAN', 'AMENITIES', 'PARKING', 'OTHER',
]

const MAX_ROOM_NAME = 30

/** "LIVING_ROOM" → "Living room". Null for an untagged photo, or one the classifier only marked as a good cover. */
export function roomName(category: string | null) {
  return category && category.toUpperCase() !== 'COVER' ? titleCase(category) : null
}

/**
 * A room name the broker typed, stored the way the classifier stores its tags: "Pooja room" → "POOJA_ROOM".
 * Null when nothing usable was typed.
 */
export function toRoomCategory(name: string) {
  const category = name
    .trim()
    .slice(0, MAX_ROOM_NAME)
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/[\s_-]+/g, '_')
    .toUpperCase()
  return category && category !== 'COVER' ? category : null
}

/** The picker's choices, keeping a custom room the photo already has. */
export function roomChoices(current: string | null) {
  const c = current?.toUpperCase()
  return c && c !== 'COVER' && !ROOM_CATEGORIES.includes(c) ? [...ROOM_CATEGORIES.slice(0, -1), c, 'OTHER'] : ROOM_CATEGORIES
}
