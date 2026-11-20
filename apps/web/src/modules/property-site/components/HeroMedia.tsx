import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import styles from '../PropertySitePage.module.css'

interface HeroMediaProps {
  photo: string
  alt: string
  /** Plays muted on a loop over the photo once it has started; the photo shows until then. */
  video?: string
  /** Pause while something covers the hero, such as the lightbox. */
  paused?: boolean
}

/** Guests who asked for less motion or less data get the photo only. */
function wantsStill(reduceMotion: boolean) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return reduceMotion || connection?.saveData === true
}

export function HeroMedia({ photo, alt, video, paused = false }: HeroMediaProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [onScreen, setOnScreen] = useState(true)
  const showVideo = Boolean(video) && !failed && !wantsStill(reduceMotion)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting))
    observer.observe(el)
    return () => observer.disconnect()
  }, [showVideo])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (paused || !onScreen) return el.pause()
    // Browsers only autoplay muted video; set it on the element, since React doesn't reliably reflect `muted`.
    el.muted = true
    el.play().catch(() => {})
  }, [showVideo, paused, onScreen])

  return (
    <>
      <img className={styles.heroImg} src={photo} alt={alt} />
      {showVideo && (
        <video
          ref={ref}
          className={`${styles.heroImg} ${styles.heroVideo} ${playing ? styles.heroVideoOn : ''}`}
          src={video}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          // A codec the browser can't decode (e.g. HEVC in Chrome) can load with no picture; keep the photo then.
          onLoadedMetadata={(e) => { if (e.currentTarget.videoWidth === 0) setFailed(true) }}
          onError={() => setFailed(true)}
        />
      )}
    </>
  )
}
