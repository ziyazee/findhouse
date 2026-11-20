import { useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Play, Share2 } from 'lucide-react'
import { getMediaUrl } from '@/lib/storage'
import type { Property, PropertyMedia } from '@/modules/properties/property.types'
import { shareProperty } from '@/modules/properties/shareProperty'
import { easeOut } from '@/shared/motion'
import { enquiryMessage, galleryGroups, isVideo, photoAlt, whatsAppLink } from '../listingContent'
import { WhatsAppIcon } from './ContactBar'
import { JustifiedRows } from './JustifiedRows'
import { rememberOrigin } from './openOrigin'
import { useMediaRatios } from './useMediaRatios'
import styles from '../PropertySitePage.module.css'

interface PhotoTourProps {
  property: Property
  /** Photos and videos, in gallery order. */
  items: PropertyMedia[]
  phone: string | null
  /** True while the lightbox is open over the tour, which then handles Escape itself. */
  covered: boolean
  onOpen: (index: number) => void
  onClose: () => void
}

/**
 * Every photo on a white page, room by room: a strip of rooms to jump to, then each room's photos whole, in rows
 * of one shared height. Tapping a photo opens it in the lightbox.
 */
export function PhotoTour({ property: p, items, phone, covered, onOpen, onClose }: PhotoTourProps) {
  const groups = useMemo(() => galleryGroups(items), [items])
  const ratioOf = useMediaRatios(items)
  const sections = useRef<(HTMLElement | null)[]>([])
  const backBtn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    backBtn.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [])

  useEffect(() => {
    if (covered) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [covered, onClose])

  const jumpTo = (i: number) => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    sections.current[i]?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
  }

  return (
    <motion.div
      className={styles.tour}
      data-photo-layer
      role="dialog"
      aria-modal="true"
      aria-labelledby="gallery-title"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: easeOut }}
    >
      <header className={styles.tourBar}>
        <button ref={backBtn} type="button" className={styles.tourBtn} onClick={onClose} aria-label="Back to the listing">
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <h1 id="gallery-title" className={styles.tourTitle}>Gallery</h1>
        <button type="button" className={styles.tourBtn} onClick={() => shareProperty(p)} aria-label="Share this home">
          <Share2 size={20} aria-hidden="true" />
        </button>
      </header>

      <div className={styles.tourBody}>
        {groups.length > 1 && (
          <nav className={styles.tourRooms} aria-label="Rooms">
            {groups.map((g, i) => (
              <button key={g.start} type="button" className={styles.tourRoom} onClick={() => jumpTo(i)}>
                <Media m={items[g.start]} alt="" />
                <span>{g.label}</span>
              </button>
            ))}
          </nav>
        )}

        {groups.map((g, i) => {
          const room = items.slice(g.start, g.start + g.count)
          return (
            <section
              key={g.start}
              ref={(el) => { sections.current[i] = el }}
              className={styles.tourSection}
              aria-labelledby={`tour-room-${i}`}
            >
              <h2 id={`tour-room-${i}`}>{g.label}</h2>
              <JustifiedRows
                ratios={room.map(ratioOf)}
                renderItem={(j, style) => {
                  const m = room[j]
                  const index = g.start + j
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={styles.tourTile}
                      style={style}
                      data-photo-index={index}
                      onClick={(e) => {
                        rememberOrigin(index, e.currentTarget)
                        onOpen(index)
                      }}
                      aria-label={isVideo(m) ? 'Play video' : `Open photo ${index + 1} of ${items.length}`}
                    >
                      <Media m={m} alt={photoAlt(m, p.title)} />
                      {isVideo(m) && <span className={styles.tilePlay} aria-hidden="true"><Play size={22} fill="currentColor" /></span>}
                    </button>
                  )
                }}
              />
            </section>
          )
        })}
      </div>

      {phone && (
        <a
          className={styles.tourCta}
          href={whatsAppLink(phone, enquiryMessage(p, window.location.origin + window.location.pathname))}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsAppIcon />
          Contact agent
        </a>
      )}
    </motion.div>
  )
}

function Media({ m, alt }: { m: PropertyMedia; alt: string }) {
  const url = getMediaUrl(m.storagePath)
  // `#t=0.1` makes Safari paint the first frame instead of a blank box.
  if (isVideo(m)) return <video src={`${url}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} aria-hidden="true" />
  return <img src={url} alt={alt} loading="lazy" draggable={false} />
}
