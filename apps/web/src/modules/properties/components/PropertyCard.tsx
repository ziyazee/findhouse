import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Bath, EllipsisVertical, ImageOff, Images, MapPin, Ruler } from 'lucide-react'
import { Menu, type MenuItem } from '@/shared/components/Menu'
import { Skeleton } from '@/shared/components/Card'
import { STATUS_TO_DB, coverUrl, formatDate, formatRent, placeOf } from '../listingStatus'
import { ListingStatusBadge } from './ListingStatusBadge'
import { VisibilityToggle } from './VisibilityToggle'
import { VisibilitySwitch } from './VisibilitySwitch'
import { shareOnWhatsApp } from '../shareProperty'
import { WhatsAppIcon } from '@/modules/property-site/components/ContactBar'
import { useMySite } from '@/modules/broker-site/useBrokerSite'
import type { Property, PropertyStatus } from '../property.types'
import styles from './PropertyCard.module.css'

interface PropertyCardProps {
  property: Property
  menuItems?: MenuItem[]
  /** Image, title, place and a share button; on phones specs and price are hidden too. */
  compact?: boolean
  /** On phones, swap the menu for a share button. */
  shareOnPhone?: boolean
  /** Shows Active / Rented / Inactive buttons on the card; the listing's visibility is the badge on the photo. */
  onStatusChange?: (status: PropertyStatus) => void
}

const SHOW_CARD_CONTROLS = false
const SHOW_CARD_MENU = false

const TONE: Record<PropertyStatus, 'toneGreen' | 'toneBlue' | 'toneRed'> = {
  available: 'toneGreen',
  rented: 'toneBlue',
  sold: 'toneRed',
}

const STATUS_BUTTONS: Array<{ status: PropertyStatus; label: string }> = [
  { status: STATUS_TO_DB.active, label: 'Active' },
  { status: STATUS_TO_DB.rented, label: 'Rented' },
  { status: STATUS_TO_DB.inactive, label: 'Inactive' },
]

export function PropertyCard({ property: p, menuItems, compact = false, onStatusChange }: PropertyCardProps) {
  const img = coverUrl(p)
  const photos = p.media.filter((m) => m.mediaType === 'image').length
  const site = useMySite()

  return (
    <article className={`${styles.card} ${compact ? styles.compact : ''}`}>
      <div className={styles.image}>
        {img ? (
          <img src={img} alt="" loading="lazy" />
        ) : (
          <div className={styles.placeholder}>
            <ImageOff size={20} aria-hidden="true" />
            <span>No photos yet</span>
          </div>
        )}
        <div className={styles.badge}><ListingStatusBadge property={p} />{!onStatusChange && <VisibilityToggle property={p} />}</div>
        {photos > 0 && (
          <span className={styles.photoCount}>
            <Images size={12} aria-hidden="true" />
            {photos}
            <span className="sr-only"> photos</span>
          </span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>
            <Link to={`/properties/${p.id}`} className={styles.link}>{p.title}</Link>
          </h3>
          {/* Temporarily hidden: the "..." actions menu. Set SHOW_CARD_MENU to true to bring back. */}
          {SHOW_CARD_MENU && !compact && menuItems && (
            <Menu
              label={`Actions for ${p.title}`}
              triggerClassName={styles.menuBtn}
              trigger={<EllipsisVertical size={16} aria-hidden="true" />}
              items={menuItems}
            />
          )}
        </div>
        <p className={styles.place}>
          <MapPin size={14} aria-hidden="true" />
          <span>{placeOf(p)}</span>
        </p>

        <ul className={styles.specs}>
          {p.bathrooms != null && <li><Bath size={14} aria-hidden="true" />{p.bathrooms} bath</li>}
          {p.builtUpArea != null && <li><Ruler size={14} aria-hidden="true" />{p.builtUpArea.toLocaleString('en-IN')} sq ft</li>}
        </ul>

        <div className={styles.footer}>
          <div className={styles.priceBlock}>
            <span className={styles.price}>{p.price ? formatRent(p) : 'Rent not set'}</span>
            <span className={styles.date}>Posted on: {formatDate(p.createdAt)}</span>
          </div>
          <button
            type="button"
            className={styles.shareBtn}
            onClick={() => shareOnWhatsApp(p, site.listingUrl(p))}
            aria-label={`Share ${p.title} on WhatsApp`}
          >
            <WhatsAppIcon />
          </button>
        </div>

        {/* Temporarily hidden: visibility switch + status buttons. Set to true to bring back. */}
        {SHOW_CARD_CONTROLS && !compact && onStatusChange && (
          <div className={styles.actionRow}>
            <VisibilitySwitch property={p} />
            <StatusSlider property={p} onChange={onStatusChange} />
          </div>
        )}
      </div>
    </article>
  )
}

/** Active / Rented / Inactive as one control; the coloured pill slides to the chosen one. */
function StatusSlider({ property: p, onChange }: { property: Property; onChange: (status: PropertyStatus) => void }) {
  const buttons = STATUS_BUTTONS.filter((b) => b.status !== STATUS_TO_DB.rented || p.listingType === 'rent' || p.status === 'rented')
  const index = Math.max(0, buttons.findIndex((b) => b.status === p.status))
  const style = { '--count': buttons.length, '--index': index } as CSSProperties

  return (
    <div className={`${styles.statusRow} ${styles[TONE[p.status]]}`} style={style} role="group" aria-label={`Status of ${p.title}`}>
      <span className={styles.statusPill} aria-hidden="true" />
      {buttons.map((b) => (
        <button
          key={b.status}
          type="button"
          className={styles.statusBtn}
          aria-pressed={p.status === b.status}
          onClick={() => p.status !== b.status && onChange(b.status)}
        >
          {b.status === STATUS_TO_DB.inactive && p.listingType === 'sale' ? 'Sold' : b.label}
        </button>
      ))}
    </div>
  )
}

export function PropertyCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <Skeleton className={styles.imageSkeleton} radius={0} />
      <div className={styles.body}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="45%" height={11} />
        <div className={styles.footer}>
          <Skeleton width={90} height={14} />
          <Skeleton width={60} height={10} />
        </div>
      </div>
    </div>
  )
}
