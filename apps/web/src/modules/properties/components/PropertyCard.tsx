import { Link } from 'react-router-dom'
import { getMediaUrl } from '@/lib/storage'
import { StatusBadge, ListingTypeBadge } from '@/shared/components/Badge'
import type { Property } from '../property.types'
import styles from './PropertyCard.module.css'

interface PropertyCardProps {
  property: Property
}

export function PropertyCard({ property }: PropertyCardProps) {
  const cover = property.media.find((m) => m.isCover) ?? property.media[0]
  const coverUrl = cover ? getMediaUrl(cover.storagePath) : null

  return (
    <Link to={`/properties/${property.id}`} className={styles.card}>
      {/* Cover image */}
      <div className={styles.image}>
        {coverUrl ? (
          <img src={coverUrl} alt={property.title} loading="lazy" />
        ) : (
          <div className={styles.imagePlaceholder}>
            <PhotoIcon />
          </div>
        )}
        <div className={styles.imageBadges}>
          <StatusBadge status={property.status} />
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.typeRow}>
          <span className={styles.propertyType}>{property.propertyType}</span>
          <ListingTypeBadge type={property.listingType} />
        </div>

        <h3 className={styles.title}>{property.title}</h3>

        {property.price && (
          <p className={styles.price}>
            ₹{property.price.toLocaleString()}
            {property.listingType === 'rent' && <span className={styles.priceUnit}>/mo</span>}
          </p>
        )}

        {(property.location || property.locality) && (
          <p className={styles.location}>
            <LocationIcon />
            {property.locality ?? property.location}
          </p>
        )}

        <div className={styles.specs}>
          {property.bedrooms != null && (
            <span className={styles.spec}><BedIcon /> {property.bedrooms} bed</span>
          )}
          {property.bathrooms != null && (
            <span className={styles.spec}><BathIcon /> {property.bathrooms} bath</span>
          )}
          {property.builtUpArea != null && (
            <span className={styles.spec}>{property.builtUpArea.toLocaleString()} sq ft</span>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.date}>{formatDate(property.createdAt)}</span>
        <span className={styles.viewLink}>View →</span>
      </div>
    </Link>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

// Icons
function PhotoIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}
function LocationIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 3 }}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}
function BedIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 3 }}>
      <path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" />
    </svg>
  )
}
function BathIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 3 }}>
      <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
      <line x1="10" x2="8" y1="5" y2="7" /><line x1="2" x2="22" y1="12" y2="12" />
    </svg>
  )
}
