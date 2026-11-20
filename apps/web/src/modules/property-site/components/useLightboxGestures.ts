import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { NO_ZOOM, TAP_ZOOM, shouldDismiss, zoomTo, type Point, type Zoom } from '../zoom'

const MOVE_SLOP = 8
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_SLOP = 30

/** What a one-finger drag turned into once it moved: a sideways swipe, a pull down to close, or a pan or pinch. */
type Mode = 'pending' | 'swipe' | 'drop' | 'zoom' | 'none'

interface Gesture {
  mode: Mode
  moved: boolean
  /** Whether it started on the photo, rather than the white around it. */
  onPhoto: boolean
  /** Where the first finger went down, on screen. */
  origin: Point
  /** Zoom, finger midpoint (from the photo's centre) and finger spread when the current pan or pinch began. */
  start: Zoom
  from: Point
  spread: number
  /** Last distance along the gesture's axis, and its speed in px/ms. */
  last: { value: number; time: number }
  velocity: number
}

interface Callbacks {
  /** A tap on the white around the photo. */
  onBackdropTap: () => void
  /** The photo was pulled down far or fast enough to close. */
  onDismiss: () => void
  /** A sideways swipe was let go `dx` pixels from where it started, moving at `velocity` px/ms. */
  onSwipeEnd: (dx: number, velocity: number) => void
}

/** The image's untransformed centre and size. Its slide must be positioned so it is the offset parent. */
function measure(img: HTMLElement) {
  const parent = img.offsetParent?.getBoundingClientRect()
  return {
    cx: (parent?.left ?? 0) + img.offsetLeft + img.offsetWidth / 2,
    cy: (parent?.top ?? 0) + img.offsetTop + img.offsetHeight / 2,
    box: { width: img.offsetWidth, height: img.offsetHeight },
  }
}

/** Midpoint of the fingers on screen, and the distance between the first two. */
function fingers(pointers: Map<number, Point>) {
  const pts = [...pointers.values()]
  return {
    cx: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    cy: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    spread: pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
  }
}

function locate(img: HTMLElement, clientX: number, clientY: number) {
  const m = measure(img)
  return { at: { x: clientX - m.cx, y: clientY - m.cy }, box: m.box }
}

/**
 * Every gesture in the lightbox, read from pointer events on its root: swipe sideways between slides (`swipe`),
 * pull the photo down to close (`drop`), tap the white to close, double-tap or pinch to zoom, pan once zoomed,
 * and Ctrl+wheel to zoom on desktop. The browser's own scrolling isn't used, because iOS Safari keeps the first
 * tap after a native swipe to itself.
 */
export function useLightboxGestures(callbacks: Callbacks) {
  const target = useRef<HTMLImageElement>(null)
  const [zoom, setZoom] = useState(NO_ZOOM)
  const [drop, setDropState] = useState(0)
  const [swipe, setSwipe] = useState(0)
  const [live, setLive] = useState(false)
  const latest = useRef(NO_ZOOM)
  const latestDrop = useRef(0)
  const cb = useRef(callbacks)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef<{ time: number; at: Point } | null>(null)

  useEffect(() => { cb.current = callbacks })

  const set = useCallback((z: Zoom) => {
    if (z.scale === latest.current.scale && z.x === latest.current.x && z.y === latest.current.y) return
    latest.current = z
    setZoom(z)
  }, [])

  const setDrop = useCallback((d: number) => {
    latestDrop.current = d
    setDropState(d)
  }, [])

  const beginZoom = (g: Gesture) => {
    const { cx, cy, spread } = fingers(pointers.current)
    g.start = latest.current
    g.from = target.current ? locate(target.current, cx, cy).at : { x: 0, y: 0 }
    g.spread = spread
  }

  const follow = (g: Gesture, value: number, time: number) => {
    const dt = time - g.last.time
    if (dt > 0) g.velocity = (value - g.last.value) / dt
    g.last = { value, time }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // A video's own controls and the "Open the video" link handle their taps themselves.
    if ((e.target as Element).closest('video, a, button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      gesture.current = {
        mode: latest.current.scale > 1 ? 'zoom' : 'pending',
        moved: false,
        onPhoto: e.target === target.current,
        origin: { x: e.clientX, y: e.clientY },
        start: latest.current,
        from: { x: 0, y: 0 },
        spread: 0,
        last: { value: 0, time: e.timeStamp },
        velocity: 0,
      }
    } else if (gesture.current && target.current) {
      // A second finger makes it a pinch, whatever the first was doing.
      gesture.current.mode = 'zoom'
      gesture.current.moved = true
      setSwipe(0)
      setDrop(0)
      setLive(true)
    }
    if (gesture.current) beginZoom(gesture.current)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const g = gesture.current
    if (!g || !pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const dx = e.clientX - g.origin.x
    const dy = e.clientY - g.origin.y
    if (!g.moved) {
      if (Math.hypot(dx, dy) < MOVE_SLOP) return
      g.moved = true
      if (g.mode === 'pending') g.mode = Math.abs(dx) >= Math.abs(dy) ? 'swipe' : dy > 0 && target.current ? 'drop' : 'none'
      setLive(true)
    }
    if (g.mode === 'swipe') {
      follow(g, dx, e.timeStamp)
      setSwipe(dx)
    } else if (g.mode === 'drop') {
      const d = Math.max(0, dy)
      follow(g, d, e.timeStamp)
      setDrop(d)
    } else if (g.mode === 'zoom' && target.current) {
      const { cx, cy, spread } = fingers(pointers.current)
      const { at, box } = locate(target.current, cx, cy)
      const scale = spread && g.spread ? (g.start.scale * spread) / g.spread : g.start.scale
      set(zoomTo(g.start, scale, g.from, at, box))
    }
  }

  const onPointerEnd = (e: ReactPointerEvent<HTMLElement>) => {
    if (!pointers.current.delete(e.pointerId)) return
    const g = gesture.current
    if (!g) return
    // One finger lifted from a pinch: carry on panning with the other.
    if (pointers.current.size > 0) return beginZoom(g)
    gesture.current = null
    setLive(false)
    if (latest.current.scale < 1.05) set(NO_ZOOM)
    const up = e.type === 'pointerup'

    if (g.mode === 'swipe') {
      if (up) cb.current.onSwipeEnd(g.last.value, g.velocity)
      setSwipe(0)
      return
    }
    if (g.mode === 'drop') {
      if (up && shouldDismiss(latestDrop.current, g.velocity)) cb.current.onDismiss()
      else setDrop(0)
      return
    }
    if (!up || g.moved) return
    if (!g.onPhoto || !target.current) return cb.current.onBackdropTap()

    const { at, box } = locate(target.current, e.clientX, e.clientY)
    const last = lastTap.current
    if (last && e.timeStamp - last.time < DOUBLE_TAP_MS && Math.hypot(at.x - last.at.x, at.y - last.at.y) < DOUBLE_TAP_SLOP) {
      lastTap.current = null
      set(latest.current.scale > 1 ? NO_ZOOM : zoomTo(NO_ZOOM, TAP_ZOOM, at, at, box))
    } else {
      lastTap.current = { time: e.timeStamp, at }
    }
  }

  /** Attach as a non-passive `wheel` listener so Ctrl+wheel doesn't zoom the whole page. */
  const onWheel = useCallback((e: WheelEvent) => {
    const img = target.current
    if (!img || !e.ctrlKey) return
    e.preventDefault()
    const { at, box } = locate(img, e.clientX, e.clientY)
    const delta = Math.max(-50, Math.min(50, e.deltaY))
    set(zoomTo(latest.current, latest.current.scale * Math.exp(-delta / 100), at, at, box))
  }, [set])

  const reset = useCallback(() => {
    pointers.current.clear()
    gesture.current = null
    lastTap.current = null
    setLive(false)
    setSwipe(0)
    set(NO_ZOOM)
    setDrop(0)
  }, [set, setDrop])

  return {
    target,
    zoom,
    drop,
    swipe,
    live,
    handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd },
    onWheel,
    reset,
  }
}
