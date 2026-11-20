import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, NO_ZOOM, clampZoom, dismissProgress, growFrom, shouldDismiss, zoomTo } from './zoom'

const box = { width: 400, height: 300 }

describe('growing a photo out of its tile', () => {
  it('starts on the tile, covering it and clipped to it', () => {
    // A 400×200 photo shown full screen at (0, 100), opened from a 100×100 square tile at (20, 500).
    const frame = growFrom({ left: 20, top: 500, width: 100, height: 100 }, { left: 0, top: 100, width: 400, height: 200 }, 10)
    // Covering the square needs the photo's height to shrink to 100: scale 0.5, so 400 wide becomes 200.
    expect(frame.transform).toBe('translate(-130px, 350px) scale(0.5)')
    // Only the middle 200×200 of the unscaled photo shows: 100px is clipped off each side.
    expect(frame.clipPath).toBe('inset(0px 100px round 20px)')
  })
})

describe('swipe down to close', () => {
  it('closes on a long drag or a quick flick, and springs back otherwise', () => {
    expect(shouldDismiss(140, 0)).toBe(true)
    expect(shouldDismiss(60, 1.2)).toBe(true)
    expect(shouldDismiss(60, 0.2)).toBe(false)
    expect(shouldDismiss(10, 2)).toBe(false)
  })

  it('fades the backdrop as the photo is dragged', () => {
    expect(dismissProgress(0)).toBe(0)
    expect(dismissProgress(165)).toBe(0.5)
    expect(dismissProgress(1000)).toBe(1)
  })
})

describe('zoom', () => {
  it('zooms around the tapped spot so it stays under the finger', () => {
    const z = zoomTo(NO_ZOOM, 2, { x: 100, y: 50 }, { x: 100, y: 50 }, box)
    expect(z).toEqual({ scale: 2, x: -100, y: -50 })
    expect(z.x + z.scale * 100).toBe(100)
  })

  it('zooms around the centre without panning', () => {
    expect(zoomTo(NO_ZOOM, 2.5, { x: 0, y: 0 }, { x: 0, y: 0 }, box)).toEqual({ scale: 2.5, x: 0, y: 0 })
  })

  it('pans with the finger while keeping the scale', () => {
    const start = { scale: 2, x: 0, y: 0 }
    expect(zoomTo(start, 2, { x: 0, y: 0 }, { x: 30, y: -20 }, box)).toEqual({ scale: 2, x: 30, y: -20 })
  })

  it('never lets the image leave its box', () => {
    const start = { scale: 2, x: 0, y: 0 }
    expect(zoomTo(start, 2, { x: 0, y: 0 }, { x: 900, y: -900 }, box)).toEqual({ scale: 2, x: 200, y: -150 })
  })

  it('keeps the scale between 1 and the maximum', () => {
    expect(zoomTo(NO_ZOOM, 20, { x: 0, y: 0 }, { x: 0, y: 0 }, box).scale).toBe(MAX_ZOOM)
    expect(clampZoom({ scale: 0.5, x: 40, y: 40 }, box)).toEqual(NO_ZOOM)
  })
})
