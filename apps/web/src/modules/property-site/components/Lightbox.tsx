import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { getMediaUrl } from '@/lib/storage'
import type { PropertyMedia } from '@/modules/properties/property.types'
import { isVideo, photoAlt } from '../listingContent'
import { dismissProgress, growFrom, type Rect } from '../zoom'
import styles from '../PropertySitePage.module.css'
import { findTile, takeOrigin, type Origin } from './openOrigin'
import { useLightboxGestures } from './useLightboxGestures'

const GROW_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
/** Share of the screen width, or px/ms, a swipe needs to move to the next slide. */
const SWIPE_DISTANCE = 0.18
const SWIPE_VELOCITY = 0.35
/** How much a swipe past the first or last slide follows the finger. */
const EDGE_RESISTANCE = 0.3

interface LightboxProps {
  /** Photos and videos, in gallery order. */
  items: PropertyMedia[]
  /** Read once when the lightbox opens. */
  start: number
  title: string
  /** Asks to close; the parent then sets `leaving`, also when Back closed it. */
  onClose: () => void
  /** True once closed: plays the closing animation, then calls `onLeft` so the parent can unmount it. */
  leaving: boolean
  onLeft: () => void
  /** Called once the guest settles on a photo. */
  onIndexChange?: (index: number) => void
}

/**
 * Full-screen viewer that shows only the photo. Swipe sideways (or use the arrow keys) to move, swipe down to
 * close; double-tap or pinch zooms a photo. Videos play only when tapped and pause when you move on.
 * Escape or a tap outside the photo closes it.
 */
export function Lightbox({ items, start, title, onClose, leaving, onLeft, onIndexChange }: LightboxProps) {
  const root = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const shade = useRef<HTMLDivElement>(null)
  const initial = useRef(start)
  const reported = useRef(start)
  const report = useRef(onIndexChange)
  const closing = useRef(false)
  const [index, setIndex] = useState(start)
  const latestIndex = useRef(start)
  const left = useRef(onLeft)
  const last = items.length - 1

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    onClose()
  }, [onClose])

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(last, i))), [last])

  const { target, zoom, drop, swipe, live, handlers, onWheel, reset } = useLightboxGestures({
    onBackdropTap: close,
    onDismiss: close,
    onSwipeEnd: (dx, velocity) => {
      const width = root.current?.clientWidth ?? 1
      if (dx < -width * SWIPE_DISTANCE || velocity < -SWIPE_VELOCITY) go(index + 1)
      else if (dx > width * SWIPE_DISTANCE || velocity > SWIPE_VELOCITY) go(index - 1)
    },
  })
  const zoomed = zoom.scale > 1
  const fade = dismissProgress(drop)
  const pastEdge = (index === 0 && swipe > 0) || (index === last && swipe < 0)
  const offset = pastEdge ? swipe * EDGE_RESISTANCE : swipe

  useEffect(() => {
    latestIndex.current = index
    left.current = onLeft
  })

  // Shrinks the photo back into its tile (or fades out when the tile isn't on screen), however it was closed.
  useEffect(() => {
    if (!leaving) return
    closing.current = true
    const done = () => left.current()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return done()
    const img = target.current
    const tile = img ? findTile(latestIndex.current) : null
    const options: KeyframeAnimationOptions = { duration: tile ? 320 : 200, easing: GROW_EASE, fill: 'forwards' }
    const fadeOut = shade.current?.animate([{ opacity: getComputedStyle(shade.current).opacity }, { opacity: 0 }], options)
    const animation = img && tile
      ? img.animate([
        { transform: getComputedStyle(img).transform, clipPath: `inset(0px 0px round ${getComputedStyle(img).borderTopLeftRadius})` },
        growFrom(tile.rect, layoutRect(img), tile.radius),
      ], options)
      : root.current?.animate([{ opacity: 1 }, { opacity: 0 }], options)
    if (!animation) return done()
    animation.onfinish = done
    // Reopened before the animation finished: put the photo back.
    return () => {
      animation.onfinish = null
      animation.cancel()
      fadeOut?.cancel()
      closing.current = false
    }
  }, [leaving, target])

  useEffect(() => {
    root.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [])

  useEffect(() => {
    const img = target.current
    if (!img || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let animation: Animation | undefined
    const run = () => { animation = growIn(img, takeOrigin(initial.current)) }
    if (img.complete && img.naturalWidth) run()
    else img.addEventListener('load', run, { once: true })
    return () => {
      img.removeEventListener('load', run)
      animation?.cancel()
    }
  }, [target])

  useEffect(() => {
    reset()
    Array.from(strip.current?.children ?? []).forEach((slide, i) => { if (i !== index) slide.querySelector('video')?.pause() })
  }, [index, reset])

  useEffect(() => { report.current = onIndexChange })
  useEffect(() => {
    if (index === reported.current) return
    const t = setTimeout(() => {
      // Writing `?photo=N` while closing would reopen it.
      if (closing.current) return
      reported.current = index
      report.current?.(index)
    }, 250)
    return () => clearTimeout(t)
  }, [index])

  useEffect(() => {
    const el = root.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A focused video uses the arrow keys to seek.
      if (e.target instanceof HTMLVideoElement && e.key !== 'Escape') return
      if (e.key === 'Escape') {
        if (zoomed) reset()
        else close()
      }
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index, close, zoomed, reset])

  const photoStyle = zoomed
    ? { transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` }
    : drop > 0 ? { transform: `translateY(${drop}px) scale(${1 - fade * 0.2})` } : undefined

  return (
    <div
      ref={root}
      className={styles.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label={`Photos of ${title}`}
      tabIndex={-1}
      {...handlers}
    >
      <div ref={shade} className={`${styles.lightboxShade} ${live ? styles.liveShade : ''}`} style={{ opacity: 1 - fade }} aria-hidden="true" />
      <button
        type="button"
        className={styles.lightboxClose}
        style={{ opacity: leaving ? 0 : 1 - fade }}
        onClick={close}
        aria-label="Close photos"
      >
        <X size={20} aria-hidden="true" />
      </button>

      <div className={styles.track}>
        <div
          ref={strip}
          className={`${styles.strip} ${live ? styles.liveStrip : ''}`}
          style={{ transform: `translateX(calc(${-index * 100}% + ${offset}px))` }}
        >
          {items.map((m, i) => {
            const isCurrent = i === index
            return (
              <div key={m.id} className={styles.slide} aria-hidden={isCurrent ? undefined : true}>
                {isVideo(m) ? (
                  <VideoSlide src={getMediaUrl(m.storagePath)} label={photoAlt(m, title)} near={Math.abs(i - index) <= 1} />
                ) : (
                  <img
                    ref={isCurrent ? target : undefined}
                    src={getMediaUrl(m.storagePath)}
                    alt={photoAlt(m, title)}
                    draggable={false}
                    className={isCurrent ? [zoomed && styles.zoomedImg, live && styles.liveImg].filter(Boolean).join(' ') : undefined}
                    style={isCurrent ? photoStyle : undefined}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Grows the photo out of the tile it was tapped in, or fades it in when it was opened some other way. */
function growIn(img: HTMLImageElement, from: Origin | null) {
  if (!from) {
    return img.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: GROW_EASE })
  }
  const radius = getComputedStyle(img).borderTopLeftRadius
  return img.animate(
    [growFrom(from.rect, layoutRect(img), from.radius), { transform: 'none', clipPath: `inset(0px 0px round ${radius})` }],
    { duration: 360, easing: GROW_EASE },
  )
}

/** Where the photo sits full screen, ignoring any transform on it. Its slide is the offset parent. */
function layoutRect(img: HTMLElement): Rect {
  const slide = (img.offsetParent as HTMLElement | null)?.getBoundingClientRect()
  return { left: (slide?.left ?? 0) + img.offsetLeft, top: (slide?.top ?? 0) + img.offsetTop, width: img.offsetWidth, height: img.offsetHeight }
}

/**
 * A video slide that loads only when it's on or next to the screen, and offers the file itself when the browser
 * can't play it (WhatsApp sends `.3gp` and iPhone HEVC `.mov` files that many browsers won't decode).
 */
function VideoSlide({ src, label, near }: { src: string; label: string; near: boolean }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className={styles.videoFallback}>
        <p>This video can’t play in your browser.</p>
        <a href={src} target="_blank" rel="noopener noreferrer">Open the video</a>
      </div>
    )
  }
  return (
    <video
      className={styles.slideVideo}
      src={src}
      aria-label={label}
      controls
      playsInline
      preload={near ? 'metadata' : 'none'}
      onError={() => setFailed(true)}
    />
  )
}
