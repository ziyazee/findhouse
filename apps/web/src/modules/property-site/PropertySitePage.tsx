import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import {
  Bath, BedDouble, Building2, CalendarDays, Car, Check, ChevronLeft, ChevronRight, Expand, Home, Images,
  Layers, MapPin, Navigation, Phone, Ruler, Share2, Sofa, SquareDashed, X,
} from 'lucide-react'
import { createPropertyService } from '@/modules/properties/PropertyService'
import { shareProperty } from '@/modules/properties/shareProperty'
import { formatDate, placeOf } from '@/modules/properties/listingStatus'
import type { Property, PropertyMedia } from '@/modules/properties/property.types'
import { getMediaUrl } from '@/lib/storage'
import { useAuthStore } from '@/modules/auth/AuthStore'
import { easeOut, rise, stagger } from '@/shared/motion'
import logoMark from '@/assets/logo-mark.png'
import fallbackPhoto from '@/assets/hero-building-navy.jpg'
import styles from './PropertySitePage.module.css'

const service = createPropertyService()

export default function PropertySitePage() {
  const { slug, order_id } = useParams<{ slug?: string; order_id?: string }>()
  const query = useQuery({
    queryKey: ['public-property', slug ?? order_id],
    queryFn: () => (slug ? service.getPropertyBySlug(slug) : service.getProperty(order_id ?? '')),
    enabled: Boolean(slug ?? order_id),
  })
  const property = query.data

  useEffect(() => {
    if (property) document.title = `${property.title} · FindHouse`
  }, [property])

  return (
    <MotionConfig reducedMotion="user">
      {query.isLoading ? <Loading /> : property ? <Listing property={property} /> : <Unavailable />}
    </MotionConfig>
  )
}

/* ── Listing ─────────────────────────────────────────────────────────────── */

function Listing({ property: p }: { property: Property }) {
  const contact = useQuery({
    queryKey: ['listing-contact', p.id],
    queryFn: () => service.getListingContact(p.id),
    staleTime: 5 * 60_000,
  })
  const viewer = useAuthStore((s) => s.session?.user)
  const ownPhone = viewer?.id === p.brokerId ? viewer.phone : null
  const phone = contact.data ?? ownPhone ?? null

  const photos = useMemo(
    () => p.media
      .filter((m) => m.mediaType === 'image')
      .sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.displayOrder - b.displayOrder),
    [p.media],
  )
  const [viewing, setViewing] = useState<number | null>(null)

  const place = placeOf(p) === '—' ? null : placeOf(p)
  const isRent = p.listingType === 'rent'
  const facts = [
    p.bedrooms != null && { icon: <BedDouble size={20} />, value: `${p.bedrooms} BHK`, label: 'Bedrooms' },
    p.bathrooms != null && { icon: <Bath size={20} />, value: String(p.bathrooms), label: p.bathrooms === 1 ? 'Bathroom' : 'Bathrooms' },
    p.builtUpArea != null && { icon: <Ruler size={20} />, value: `${p.builtUpArea.toLocaleString('en-IN')} sq ft`, label: 'Built-up area' },
    p.furnishing && { icon: <Sofa size={20} />, value: titleCase(p.furnishing), label: 'Furnishing' },
  ].filter(Boolean) as Fact[]

  const details = [
    { icon: <Home size={18} />, label: 'Property type', value: titleCase(p.propertyType) },
    { icon: <Building2 size={18} />, label: 'Listed for', value: isRent ? 'Rent' : 'Sale' },
    p.carpetArea != null && { icon: <SquareDashed size={18} />, label: 'Carpet area', value: `${p.carpetArea.toLocaleString('en-IN')} sq ft` },
    p.floor && { icon: <Layers size={18} />, label: 'Floor', value: p.totalFloors ? `${p.floor} of ${p.totalFloors}` : p.floor },
    p.parking && { icon: <Car size={18} />, label: 'Parking', value: titleCase(p.parking) },
    { icon: <CalendarDays size={18} />, label: 'Listed on', value: formatDate(p.createdAt) },
  ].filter(Boolean) as Detail[]

  const description = p.description?.trim() || defaultDescription(p, place)
  const mapsUrl = place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}` : null
  const cover = photos[0]

  return (
    <div className={`${styles.page} ${phone ? styles.withBar : ''}`}>
      <header className={styles.hero}>
        <img
          className={styles.heroImg}
          src={cover ? getMediaUrl(cover.storagePath) : fallbackPhoto}
          alt={cover ? photoAlt(cover, p.title) : ''}
        />
        <nav className={styles.nav} aria-label="FindHouse">
          <span className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true"><img src={logoMark} alt="" /></span>
            FindHouse
          </span>
          <button type="button" className={styles.glassBtn} onClick={() => shareProperty(p)} aria-label="Share this home">
            <Share2 size={18} aria-hidden="true" />
            <span className={styles.glassLabel}>Share</span>
          </button>
        </nav>

        <motion.div className={styles.heroText} variants={stagger(0.08, 0.1)} initial="hidden" animate="show">
          <motion.div className={styles.eyebrow} variants={rise}>
            <span className={styles.pill}>{isRent ? 'For rent' : 'For sale'}</span>
            <span className={styles.pillQuiet}>{titleCase(p.propertyType)}</span>
          </motion.div>
          <motion.h1 className={styles.title} variants={rise}>{p.title}</motion.h1>
          {place && (
            <motion.p className={styles.place} variants={rise}>
              <MapPin size={16} aria-hidden="true" />{place}
            </motion.p>
          )}
          {photos.length > 0 && (
            <motion.button type="button" className={`${styles.glassBtn} ${styles.photosBtn}`} onClick={() => setViewing(0)} variants={rise}>
              <Images size={16} aria-hidden="true" />
              <span>{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</span>
            </motion.button>
          )}
        </motion.div>
      </header>

      <main className={styles.main}>
        <motion.section
          className={styles.summary}
          aria-label="Price and key facts"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: easeOut, delay: 0.25 }}
        >
          <div className={styles.price}>
            <span className={styles.priceLabel}>{isRent ? 'Monthly rent' : 'Asking price'}</span>
            {p.price ? (
              <span className={styles.priceValue}>
                ₹{p.price.toLocaleString('en-IN')}
                {isRent && <small>/month</small>}
              </span>
            ) : (
              <span className={`${styles.priceValue} ${styles.onRequest}`}>Price on request</span>
            )}
            {p.price != null && p.price >= 1e5 && <span className={styles.priceHint}>{inWords(p.price)}</span>}
          </div>
          {facts.length > 0 && (
            <ul className={styles.facts}>
              {facts.map((f, i) => (
                <li key={f.label} className={styles[`tint${i % 4}`]}>
                  <span className={styles.factIcon} aria-hidden="true">{f.icon}</span>
                  <span className={styles.factValue}>{f.value}</span>
                  <span className={styles.factLabel}>{f.label}</span>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        <div className={styles.columns}>
          <div className={styles.primary}>
            <Section title="About this home">
              <p className={styles.description}>{description}</p>
            </Section>

            {photos.length > 0 && (
              <Section title="Photos" aside={`${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`}>
                <PhotoGrid photos={photos} title={p.title} onOpen={setViewing} />
              </Section>
            )}

            {p.amenities.length > 0 && (
              <Section title="Amenities" aside={`${p.amenities.length} included`}>
                <ul className={styles.amenities}>
                  {p.amenities.map((a) => (
                    <li key={a}><span className={styles.check} aria-hidden="true"><Check size={14} strokeWidth={2.5} /></span>{a}</li>
                  ))}
                </ul>
              </Section>
            )}

            {place && (
              <Section title="Location">
                <div className={styles.location}>
                  <span className={styles.locationIcon} aria-hidden="true"><MapPin size={22} /></span>
                  <div className={styles.locationText}>
                    <strong>{p.locality || place}</strong>
                    {p.locality && p.location && p.location !== p.locality && <span>{p.location}</span>}
                  </div>
                  {mapsUrl && (
                    <a className={styles.mapsLink} href={mapsUrl} target="_blank" rel="noopener noreferrer">
                      <Navigation size={16} aria-hidden="true" />
                      Open in Maps
                    </a>
                  )}
                </div>
              </Section>
            )}
          </div>

          <aside className={styles.secondary}>
            <Section title="At a glance" className={styles.glance}>
              <dl className={styles.details}>
                {details.map((d) => (
                  <div key={d.label} className={styles.detail}>
                    <dt><span aria-hidden="true">{d.icon}</span>{d.label}</dt>
                    <dd>{d.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
            {phone && (
              <div className={styles.agent}>
                <span className={styles.agentMark} aria-hidden="true"><Phone size={18} /></span>
                <div>
                  <span className={styles.agentLabel}>Listed by the agent</span>
                  <a className={styles.agentPhone} href={`tel:+${phone}`}>{formatPhone(phone)}</a>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      <footer className={styles.footer}>
        <span className={styles.brandSmall}>
          <span className={styles.brandMark} aria-hidden="true"><img src={logoMark} alt="" /></span>
          FindHouse
        </span>
        <p>Shared with you by the property’s agent.</p>
      </footer>

      {phone && <ContactBar property={p} phone={phone} />}
      {viewing != null && (
        <Lightbox photos={photos} start={viewing} title={p.title} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}

interface Fact { icon: ReactNode; value: string; label: string }
interface Detail { icon: ReactNode; label: string; value: string }

function Section({ title, aside, className, children }: { title: string; aside?: string; className?: string; children: ReactNode }) {
  return (
    <motion.section
      className={`${styles.section} ${className ?? ''}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      transition={{ duration: 0.5, ease: easeOut }}
    >
      <div className={styles.sectionHead}>
        <h2>{title}</h2>
        {aside && <span>{aside}</span>}
      </div>
      {children}
    </motion.section>
  )
}

/* ── Photos ──────────────────────────────────────────────────────────────── */

const GRID_MAX = 5

function PhotoGrid({ photos, title, onOpen }: { photos: PropertyMedia[]; title: string; onOpen: (i: number) => void }) {
  const shown = photos.slice(0, GRID_MAX)
  const extra = photos.length - shown.length
  return (
    <div className={styles.grid} data-count={shown.length}>
      {shown.map((m, i) => {
        const more = i === shown.length - 1 && extra > 0
        return (
          <button
            key={m.id}
            type="button"
            className={styles.tile}
            onClick={() => onOpen(i)}
            aria-label={more ? `View all ${photos.length} photos` : `Open photo ${i + 1} of ${photos.length}`}
          >
            <img src={getMediaUrl(m.storagePath)} alt={photoAlt(m, title)} loading="lazy" />
            {m.category && !more && <span className={styles.tileTag}>{categoryLabel(m.category)}</span>}
            {more && <span className={styles.tileMore}>+{extra}<small>more</small></span>}
            {!more && <span className={styles.tileZoom} aria-hidden="true"><Expand size={14} /></span>}
          </button>
        )
      })}
    </div>
  )
}

function Lightbox({ photos, start, title, onClose }: { photos: PropertyMedia[]; start: number; title: string; onClose: () => void }) {
  const track = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const [index, setIndex] = useState(start)

  const go = useCallback((i: number) => {
    const el = track.current
    if (!el) return
    const next = Math.max(0, Math.min(photos.length - 1, i))
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }, [photos.length])

  useEffect(() => {
    const el = track.current
    if (el) el.scrollLeft = start * el.clientWidth
    closeBtn.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [start])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index, onClose])

  const onScroll = () => {
    const el = track.current
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  const current = photos[index]
  return (
    <motion.div
      className={styles.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label={`Photos of ${title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className={styles.lightboxBar}>
        <span className={styles.counter} aria-live="polite">
          {index + 1} / {photos.length}
          {current?.category && <em>{categoryLabel(current.category)}</em>}
        </span>
        <button ref={closeBtn} type="button" className={styles.lightboxBtn} onClick={onClose} aria-label="Close photos">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div ref={track} className={styles.track} onScroll={onScroll}>
        {photos.map((m) => (
          <div key={m.id} className={styles.slide} onClick={onClose}>
            <img src={getMediaUrl(m.storagePath)} alt={photoAlt(m, title)} onClick={(e) => e.stopPropagation()} />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button type="button" className={`${styles.lightboxBtn} ${styles.prev}`} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous photo">
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button type="button" className={`${styles.lightboxBtn} ${styles.next}`} onClick={() => go(index + 1)} disabled={index === photos.length - 1} aria-label="Next photo">
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </>
      )}
    </motion.div>
  )
}

/* ── Contact bar ─────────────────────────────────────────────────────────── */

/** Pixels of scroll before the contact bar slides up. */
const BAR_AFTER = 160

function ContactBar({ property: p, phone }: { property: Property; phone: string }) {
  const shown = useScrolledPast(BAR_AFTER)
  const message = `Hi, I'm interested in "${p.title}"${p.locality ? ` in ${p.locality}` : ''}. Is it still available?\n${window.location.href}`
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          className={styles.bar}
          role="region"
          aria-label="Contact the agent"
          initial={{ y: 140, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 140, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        >
          <div className={styles.barInner}>
            <div className={styles.barSummary}>
              <span className={styles.barTitle}>{p.title}</span>
              <span className={styles.barPrice}>
                {p.price ? `₹${p.price.toLocaleString('en-IN')}${p.listingType === 'rent' ? ' / month' : ''}` : 'Price on request'}
              </span>
            </div>
            <a className={styles.callBtn} href={`tel:+${phone}`}>
              <Phone size={18} aria-hidden="true" />
              Call
            </a>
            <a className={styles.whatsappBtn} href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon />
              WhatsApp
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** True once the page has scrolled past `offset`, or straight away when the page is too short to scroll that far. */
function useScrolledPast(offset: number) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const update = () => {
      const room = document.documentElement.scrollHeight - window.innerHeight
      setPast(room < offset * 2 || window.scrollY > offset)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [offset])
  return past
}

function WhatsAppIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

/* ── Loading and missing states ──────────────────────────────────────────── */

function Loading() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading this home">
      <div className={`${styles.hero} ${styles.heroLoading}`} />
      <main className={styles.main}>
        <div className={`${styles.summary} ${styles.summaryLoading}`}>
          <span className={styles.shimmer} style={{ width: 120, height: 12 }} />
          <span className={styles.shimmer} style={{ width: 220, height: 30 }} />
          <span className={styles.shimmer} style={{ width: '100%', height: 84 }} />
        </div>
      </main>
    </div>
  )
}

function Unavailable() {
  return (
    <div className={styles.missing}>
      <span className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true"><img src={logoMark} alt="" /></span>
        FindHouse
      </span>
      <motion.div className={styles.missingCard} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut }}>
        <span className={styles.missingIcon} aria-hidden="true"><Home size={26} /></span>
        <h1>This home is no longer listed</h1>
        <p>It may have been rented or sold, or the link may be incomplete. Ask the agent who shared it for the latest options.</p>
      </motion.div>
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function titleCase(s: string) {
  const t = s.replace(/_+/g, ' ').trim().toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function categoryLabel(c: string) {
  return titleCase(c)
}

function photoAlt(m: PropertyMedia, title: string) {
  return m.category ? `${categoryLabel(m.category)}, ${title}` : title
}

function inWords(n: number) {
  const trim = (x: number) => Number(x.toFixed(2)).toString()
  return n >= 1e7 ? `₹${trim(n / 1e7)} crore` : `₹${trim(n / 1e5)} lakh`
}

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, '')
  return d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : `+${d}`
}

function defaultDescription(p: Property, place: string | null) {
  const size = p.bedrooms != null ? `${p.bedrooms} BHK ` : ''
  const kind = titleCase(p.propertyType).toLowerCase()
  const where = place ? ` in ${place}` : ''
  const furnishing = p.furnishing ? ` It comes ${titleCase(p.furnishing).toLowerCase()}` : ''
  const area = p.builtUpArea ? `${furnishing ? ', with' : ' It offers'} ${p.builtUpArea.toLocaleString('en-IN')} sq ft of living space` : ''
  return `A well-kept ${size}${kind}${where}, available for ${p.listingType === 'rent' ? 'rent' : 'sale'}.${furnishing}${area}${furnishing || area ? '.' : ''} Get in touch to arrange a visit.`
}
