import { Link } from 'react-router-dom'
import { Bath, BedDouble, EllipsisVertical, ImageOff, Images, MapPin, Ruler, Share2 } from 'lucide-react'
import { Menu, type MenuItem } from '@/shared/components/Menu'
import { Skeleton } from '@/shared/components/Card'
import { coverUrl, formatDate, formatRent, placeOf } from '../listingStatus'
import { ListingStatusBadge } from './ListingStatusBadge'
import { VisibilityToggle } from './VisibilityToggle'
import { shareProperty } from '../shareProperty'
import { useMySite } from '@/modules/broker-site/useBrokerSite'
import type { Property } from '../property.types'
import styles from './PropertyCard.module.css'

interface PropertyCardProps {
  property: Property
  menuItems?: MenuItem[]
  /** Image, title, place and a share button; on phones specs and price are hidden too. */
  compact?: boolean
  /** On phones, swap the menu for a share button. */
  shareOnPhone?: boolean
}

export function PropertyCard({ property: p, menuItems, compact = false, shareOnPhone = false }: PropertyCardProps) {
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
        <div className={styles.badge}><ListingStatusBadge property={p} /><VisibilityToggle property={p} /></div>
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
          {(compact || shareOnPhone) && (
            <button
              type="button"
              className={`${styles.shareBtn} ${compact ? '' : styles.phoneOnly}`}
              onClick={() => shareProperty(p, site.listingUrl(p))}
              aria-label={`Share ${p.title}`}
            >
              <Share2 size={16} aria-hidden="true" />
            </button>
          )}
          {!compact && menuItems && (
            <Menu
              label={`Actions for ${p.title}`}
              triggerClassName={`${styles.menuBtn} ${shareOnPhone ? styles.desktopOnly : ''}`}
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
          {p.bedrooms != null && <li><BedDouble size={14} aria-hidden="true" />{p.bedrooms} bed</li>}
          {p.bathrooms != null && <li><Bath size={14} aria-hidden="true" />{p.bathrooms} bath</li>}
          {p.builtUpArea != null && <li><Ruler size={14} aria-hidden="true" />{p.builtUpArea.toLocaleString('en-IN')} sq ft</li>}
        </ul>

        <div className={styles.footer}>
          <span className={styles.price}>{p.price ? formatRent(p) : 'Rent not set'}</span>
          <span className={styles.date}>{formatDate(p.createdAt)}</span>
        </div>
      </div>
    </article>
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
