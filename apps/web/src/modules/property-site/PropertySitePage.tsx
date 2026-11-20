import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MotionConfig, motion } from 'framer-motion'
import {
  Bath, BedDouble, CalendarCheck, CalendarDays, Car, Check, Clock, Fence, Handshake, Home, Images, IndianRupee, Info,
  ArrowRight, Layers, Lock, MapPin, Navigation, PawPrint, Phone, Ruler, Scan, Share2, Sofa, SquareDashed, Users, Utensils, Wallet, Wrench,
} from 'lucide-react'
import { propertyService } from '@/modules/properties/PropertyService'
import {
  availabilityLine, availabilityValue, depositLine, listingExtras, maintenanceLine, maintenanceValue, pricePerSqftLine,
  type ListingExtra,
} from '@/modules/properties/listingExtras'
import { propertyKeys } from '@/modules/properties/queryKeys'
import { shareProperty } from '@/modules/properties/shareProperty'
import { formatDate, placeOf } from '@/modules/properties/listingStatus'
import type { Property } from '@/modules/properties/property.types'
import { siteSubdomain } from '@/lib/site'
import { getMediaUrl } from '@/lib/storage'
import { useAuthStore } from '@/modules/auth/AuthStore'
import { rupeesInWords } from '@/shared/format'
import { easeOut, rise, stagger } from '@/shared/motion'
import logoMark from '@/assets/logo-mark.png'
import fallbackPhoto from '@/assets/hero-building-navy.jpg'
import { ContactBar } from './components/ContactBar'
import { HeroMedia } from './components/HeroMedia'
import { Lightbox } from './components/Lightbox'
import { PhotoGrid } from './components/PhotoGrid'
import { PhotoTour } from './components/PhotoTour'
import { Section } from './components/Section'
import { Loading, Unavailable } from './components/SiteStates'
import { useCanonicalSite } from './components/useCanonicalSite'
import { useNoIndex } from './components/useNoIndex'
import { usePhotoParam } from './components/usePhotoParam'
import { useTourParam } from './components/useTourParam'
import {
  defaultDescription, formatPhone, galleryMedia, isVideo, mapEmbedUrl, mapsLink, mediaCount, photoAlt, propertyTypeLabel, sharedMapsLink,
  titleCase,
} from './listingContent'
import styles from './PropertySitePage.module.css'

export default function PropertySitePage() {
  const { slug, order_id } = useParams<{ slug?: string; order_id?: string }>()
  const query = useQuery({
    queryKey: propertyKeys.publicPage(slug ?? order_id ?? ''),
    queryFn: () => (slug ? propertyService.getPropertyBySlug(slug) : propertyService.getProperty(order_id ?? '')),
    enabled: Boolean(slug ?? order_id),
  })
  const property = query.data
  const moving = useCanonicalSite(property)

  useEffect(() => {
    if (property) document.title = `${property.title} · FindHouse`
  }, [property])

  return (
    <MotionConfig reducedMotion="user">
      {query.isLoading || moving ? <Loading /> : property ? <Listing property={property} /> : <Unavailable failed={query.isError} />}
    </MotionConfig>
  )
}

/* ── Listing ─────────────────────────────────────────────────────────────── */

function Listing({ property: p }: { property: Property }) {
  const contact = useQuery({
    queryKey: propertyKeys.contact(p.id),
    queryFn: () => propertyService.getListingContact(p.id),
    staleTime: 5 * 60_000,
  })
  const agentName = useQuery({
    queryKey: propertyKeys.agentName(p.id),
    queryFn: () => propertyService.getListingAgentName(p.id),
    staleTime: 5 * 60_000,
  })
  const viewer = useAuthStore((s) => s.session?.user)
  const isOwner = viewer?.id === p.brokerId
  const phone = contact.data ?? (isOwner ? viewer.phone : null) ?? null
  const agent = agentName.data ?? (isOwner ? viewer.name : null) ?? null
  useNoIndex(!p.isPublic)

  const items = useMemo(() => galleryMedia(p.media), [p.media])
  const gallery = usePhotoParam(items.length)
  // Outlives `?photo=N` so the lightbox can animate out, however it was closed.
  const [viewing, setViewing] = useState(gallery.open)
  if (gallery.open != null && viewing == null) setViewing(gallery.open)
  const tour = useTourParam()
  const touring = tour.open && items.length > 0
  const place = placeOf(p) === '—' ? null : placeOf(p)
  const isRent = p.listingType === 'rent'
  const facts = [
    p.bedrooms != null && { icon: <BedDouble size={20} />, value: `${p.bedrooms} BHK`, label: 'Bedrooms' },
    p.bathrooms != null && { icon: <Bath size={20} />, value: String(p.bathrooms), label: p.bathrooms === 1 ? 'Bathroom' : 'Bathrooms' },
    p.builtUpArea != null && { icon: <Scan size={20} />, value: `${p.builtUpArea.toLocaleString('en-IN')} sq ft`, label: 'Built-up area' },
    p.furnishing && { icon: <Sofa size={20} />, value: titleCase(p.furnishing), label: 'Furnishing' },
  ].filter(Boolean) as Fact[]

  const propertyType = propertyTypeLabel(p)
  const perSqft = pricePerSqftLine(p)
  const maintenance = maintenanceValue(p)
  const availability = availabilityValue(p)
  const details = [
    propertyType && { icon: <Home size={18} />, label: 'Property type', value: propertyType },
    p.price && { icon: <IndianRupee size={18} />, label: isRent ? 'Monthly rent' : 'Asking price', value: `₹${p.price.toLocaleString('en-IN')}${isRent ? '/month' : ''}` },
    perSqft && { icon: <Ruler size={18} />, label: 'Price per sq ft', value: perSqft },
    maintenance && { icon: <Wrench size={18} />, label: 'Maintenance', value: maintenance },
    p.deposit && { icon: <Wallet size={18} />, label: 'Security deposit', value: `₹${p.deposit.toLocaleString('en-IN')}` },
    availability && { icon: <CalendarCheck size={18} />, label: isRent ? 'Available from' : 'Possession', value: availability },
    p.bedrooms != null && { icon: <BedDouble size={18} />, label: 'Bedrooms', value: `${p.bedrooms} BHK` },
    p.bathrooms != null && { icon: <Bath size={18} />, label: 'Bathrooms', value: String(p.bathrooms) },
    p.builtUpArea != null && { icon: <Scan size={18} />, label: 'Built-up area', value: `${p.builtUpArea.toLocaleString('en-IN')} sq ft` },
    p.carpetArea != null && { icon: <SquareDashed size={18} />, label: 'Carpet area', value: `${p.carpetArea.toLocaleString('en-IN')} sq ft` },
    p.furnishing && { icon: <Sofa size={18} />, label: 'Furnishing', value: titleCase(p.furnishing) },
    p.floor && { icon: <Layers size={18} />, label: 'Floor', value: p.totalFloors ? `${p.floor} of ${p.totalFloors}` : p.floor },
    p.parking && { icon: <Car size={18} />, label: 'Parking', value: titleCase(p.parking) },
    ...listingExtras(p).map((x) => ({ icon: TERM_ICONS[x.label] ?? EXTRA_ICONS[x.kind], label: x.label, value: x.value })),
    { icon: <CalendarDays size={18} />, label: 'Listed on', value: formatDate(p.createdAt) },
  ].filter(Boolean) as Detail[]
  const priceExtras = [pricePerSqftLine(p), maintenanceLine(p), depositLine(p), availabilityLine(p)]
    .filter((s): s is string => Boolean(s))

  const description = p.description?.trim() || defaultDescription(p, place)
  const sharedLink = sharedMapsLink(p)
  const mapEmbed = sharedLink ? mapEmbedUrl(sharedLink, place) : null
  const mapsUrl = sharedLink ?? (place ? mapsLink(place) : null)
  const cover = items.find((m) => !isVideo(m))
  const heroVideo = items.find(isVideo)

  return (
    <div className={`${styles.page} ${phone ? styles.withBar : ''}`}>
      <header className={styles.hero}>
        <HeroMedia
          photo={cover ? getMediaUrl(cover.storagePath) : fallbackPhoto}
          alt={cover ? photoAlt(cover, p.title) : ''}
          video={heroVideo && getMediaUrl(heroVideo.storagePath)}
          paused={gallery.open != null || touring}
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
            {propertyType && <span className={styles.pillQuiet}>{propertyType}</span>}
          </motion.div>
          <motion.h1 className={styles.title} variants={rise}>{p.title}</motion.h1>
          {place && (
            <motion.p className={styles.place} variants={rise}>
              <MapPin size={16} aria-hidden="true" />{place}
            </motion.p>
          )}
          {items.length > 0 && (
            <motion.button type="button" className={`${styles.glassBtn} ${styles.photosBtn}`} onClick={tour.show} variants={rise}>
              <Images size={16} aria-hidden="true" />
              <span>{mediaCount(items)}</span>
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
            {p.price != null && p.price >= 1e5 && <span className={styles.priceHint}>{rupeesInWords(p.price)}</span>}
            {priceExtras.length > 0 && (
              <ul className={styles.priceExtras}>
                {priceExtras.map((line) => <li key={line}>{line}</li>)}
              </ul>
            )}
          </div>
          {facts.length > 0 && (
            <ul className={styles.facts} data-count={facts.length} style={{ '--facts': facts.length } as CSSProperties}>
              {facts.map((f) => (
                <li key={f.label}>
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
            {items.length > 0 && (
              <Section title="Gallery" aside={mediaCount(items)}>
                <PhotoGrid items={items} title={p.title} onOpen={gallery.show} onShowAll={tour.show} />
              </Section>
            )}

            <Section title="Property details">
              <dl className={styles.details}>
                {details.map((d) => (
                  <div key={d.label} className={styles.detail}>
                    <dt><span aria-hidden="true">{d.icon}</span>{d.label}</dt>
                    <dd>{d.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section title="About this property">
              <p className={styles.description}>{description}</p>
            </Section>

            {p.amenities.length > 0 && (
              <Section title="Amenities" aside={`${p.amenities.length} included`}>
                <ul className={styles.amenities}>
                  {p.amenities.map((a) => (
                    <li key={a}><span className={styles.check} aria-hidden="true"><Check size={14} strokeWidth={2.5} /></span>{a}</li>
                  ))}
                </ul>
              </Section>
            )}

            {(place || sharedLink) && (
              <Section title="Location">
                {mapEmbed && (
                  <div className={styles.map}>
                    <iframe
                      src={mapEmbed}
                      title={`Map of ${p.locality || place || p.title}`}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                )}
                <div className={styles.location}>
                  {place && (
                    <>
                      <span className={styles.locationIcon} aria-hidden="true"><MapPin size={18} /></span>
                      <div className={styles.locationText}>
                        <strong>{p.locality || place}</strong>
                        {p.locality && p.location && p.location !== p.locality && <span>{p.location}</span>}
                      </div>
                    </>
                  )}
                  {mapsUrl && (
                    <a className={styles.mapsLink} href={mapsUrl} target="_blank" rel="noopener noreferrer">
                      <Navigation size={14} aria-hidden="true" />
                      Open in Maps
                    </a>
                  )}
                </div>
              </Section>
            )}

            {phone && (
              <div className={styles.agent}>
                <span className={styles.agentMark} aria-hidden="true"><Phone size={18} /></span>
                <div>
                  <span className={styles.agentLabel}>{agent ? `Listed by ${agent}` : 'Listed by the agent'}</span>
                  <a className={styles.agentPhone} href={`tel:+${phone}`}>{formatPhone(phone)}</a>
                </div>
                {p.isPublic && p.brokerId && (
                  <Link className={styles.agentMore} to={siteSubdomain ? '/' : `/b/${p.brokerId}`}>
                    More homes<ArrowRight size={16} aria-hidden="true" />
                  </Link>
                )}
              </div>
            )}
          </div>
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
      {touring && (
        <PhotoTour
          property={p}
          items={items}
          phone={phone}
          covered={gallery.open != null}
          onOpen={gallery.show}
          onClose={tour.close}
        />
      )}
      {viewing != null && (
        <Lightbox
          items={items}
          start={viewing}
          title={p.title}
          onClose={gallery.close}
          leaving={gallery.open == null}
          onLeft={() => setViewing(null)}
          onIndexChange={gallery.follow}
        />
      )}
    </div>
  )
}

interface Fact { icon: ReactNode; value: string; label: string }
interface Detail { icon: ReactNode; label: string; value: string }

const EXTRA_ICONS: Record<ListingExtra['kind'], ReactNode> = {
  balconies: <Fence size={18} />,
  other: <Info size={18} />,
}

const TERM_ICONS: Record<string, ReactNode> = {
  'Preferred tenants': <Users size={18} />,
  'Pets allowed': <PawPrint size={18} />,
  'Non-veg allowed': <Utensils size={18} />,
  'Lock-in period': <Lock size={18} />,
  'Notice period': <Clock size={18} />,
  Brokerage: <Handshake size={18} />,
}
