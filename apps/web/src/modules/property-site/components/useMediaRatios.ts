import { useEffect, useReducer } from 'react'
import { getMediaUrl } from '@/lib/storage'
import type { PropertyMedia } from '@/modules/properties/property.types'
import { isVideo } from '../listingContent'

/** Width ÷ height of each photo or video by URL, kept for the session so every gallery lays out the same. */
const ratios = new Map<string, number>()

const GUESS_PHOTO = 4 / 3
const GUESS_VIDEO = 16 / 9

/**
 * The shape (width ÷ height) of each item, read once it loads, so galleries can show it whole. Until then it's
 * guessed (4:3 for photos, 16:9 for videos), and the layout settles as shapes arrive.
 */
export function useMediaRatios(items: PropertyMedia[]) {
  const [, update] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    let mounted = true
    const pending: Array<() => void> = []
    for (const m of items) {
      const url = getMediaUrl(m.storagePath)
      if (ratios.has(url)) continue
      const done = (width: number, height: number) => {
        if (!width || !height) return
        ratios.set(url, width / height)
        if (mounted) update()
      }
      if (isVideo(m)) {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.muted = true
        video.onloadedmetadata = () => done(video.videoWidth, video.videoHeight)
        video.src = url
        pending.push(() => { video.onloadedmetadata = null; video.removeAttribute('src'); video.load() })
      } else {
        const img = new Image()
        img.onload = () => done(img.naturalWidth, img.naturalHeight)
        img.src = url
        pending.push(() => { img.onload = null })
      }
    }
    return () => {
      mounted = false
      pending.forEach((stop) => stop())
    }
  }, [items])

  return (m: PropertyMedia) => ratios.get(getMediaUrl(m.storagePath)) ?? (isVideo(m) ? GUESS_VIDEO : GUESS_PHOTO)
}
