/** Photo zoom in the lightbox: a scale plus a pan offset from the image's centre, in screen pixels. */
export interface Zoom { scale: number; x: number; y: number }
export interface Point { x: number; y: number }
export interface Size { width: number; height: number }

export const NO_ZOOM: Zoom = { scale: 1, x: 0, y: 0 }
export const MAX_ZOOM = 4
export const TAP_ZOOM = 2.5

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export interface Rect { left: number; top: number; width: number; height: number }

/**
 * The first frame of growing a photo out of the tile it was tapped in: scaled to cover the tile, moved onto it
 * and clipped to the tile's shape. `photo` is where the photo sits full screen, untransformed.
 */
export function growFrom(tile: Rect, photo: Rect, radius: number) {
  const scale = Math.max(tile.width / photo.width, tile.height / photo.height)
  const dx = tile.left + tile.width / 2 - (photo.left + photo.width / 2)
  const dy = tile.top + tile.height / 2 - (photo.top + photo.height / 2)
  const ix = Math.max(0, (photo.width - tile.width / scale) / 2)
  const iy = Math.max(0, (photo.height - tile.height / scale) / 2)
  return {
    transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
    clipPath: `inset(${iy}px ${ix}px round ${radius / scale}px)`,
  }
}

/** Pixels the photo must be dragged down, or px/ms it must be flicked at, to close the lightbox. */
export const DISMISS_DISTANCE = 110
export const DISMISS_VELOCITY = 0.6

/** Whether letting go of a downward drag closes the lightbox. */
export function shouldDismiss(drop: number, velocity: number) {
  return drop > DISMISS_DISTANCE || (drop > 20 && velocity > DISMISS_VELOCITY)
}

/** How far the backdrop has faded (0 to 1) for a drag of `drop` pixels. */
export function dismissProgress(drop: number) {
  return clamp(drop / (DISMISS_DISTANCE * 3), 0, 1)
}

/** Keeps the scale in range and the image covering its own box, so it can't be dragged off screen. */
export function clampZoom(z: Zoom, box: Size): Zoom {
  const scale = clamp(z.scale, 1, MAX_ZOOM)
  if (scale === 1) return NO_ZOOM
  const maxX = ((scale - 1) * box.width) / 2
  const maxY = ((scale - 1) * box.height) / 2
  return { scale, x: clamp(z.x, -maxX, maxX), y: clamp(z.y, -maxY, maxY) }
}

/**
 * Moves from `start` to `scale` so the spot that was under `from` ends up under `to`.
 * Points are offsets from the image's centre. Pinch, pan and tap-to-zoom are all this one move.
 */
export function zoomTo(start: Zoom, scale: number, from: Point, to: Point, box: Size): Zoom {
  const s = clamp(scale, 1, MAX_ZOOM)
  const k = s / start.scale
  return clampZoom({ scale: s, x: to.x - (from.x - start.x) * k, y: to.y - (from.y - start.y) * k }, box)
}
