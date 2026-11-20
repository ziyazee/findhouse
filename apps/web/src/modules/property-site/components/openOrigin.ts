import type { Rect } from '../zoom'

export interface Origin { index: number; rect: Rect; radius: number; at: number }

/** How long after a tap the lightbox still grows out of the tapped tile. */
const FRESH_MS = 1000

let origin: Origin | null = null

function originOf(index: number, tile: HTMLElement): Origin {
  const { left, top, width, height } = tile.getBoundingClientRect()
  const radius = parseFloat(getComputedStyle(tile).borderTopLeftRadius) || 0
  return { index, rect: { left, top, width, height }, radius, at: Date.now() }
}

/** Remembers the tile a photo was opened from, so the lightbox can grow the photo out of it. */
export function rememberOrigin(index: number, tile: HTMLElement) {
  origin = originOf(index, tile)
}

/** The tile the lightbox's photo was just opened from; null when it was opened some other way. */
export function takeOrigin(index: number) {
  return origin?.index === index && Date.now() - origin.at < FRESH_MS ? origin : null
}

/**
 * The on-screen tile showing photo `index`, for the lightbox to shrink back into. Tiles carry `data-photo-index`;
 * when the full-screen gallery is open only its tiles count, since the page's are hidden under it.
 */
export function findTile(index: number): Origin | null {
  const layer = document.querySelector('[data-photo-layer]') ?? document
  for (const tile of layer.querySelectorAll<HTMLElement>(`[data-photo-index="${index}"]`)) {
    const r = tile.getBoundingClientRect()
    if (r.width > 0 && r.bottom > 0 && r.top < window.innerHeight) return originOf(index, tile)
  }
  return null
}
