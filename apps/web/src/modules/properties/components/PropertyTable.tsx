import { Link } from 'react-router-dom'
import { EllipsisVertical, ImageOff } from 'lucide-react'
import { Menu, type MenuItem } from '@/shared/components/Menu'
import { Skeleton } from '@/shared/components/Card'
import { coverUrl, formatDate, formatRent, placeOf } from '../listingStatus'
import { ListingStatusBadge } from './ListingStatusBadge'
import { VisibilityToggle } from './VisibilityToggle'
import type { Property } from '../property.types'
import styles from './PropertyTable.module.css'

interface PropertyTableProps {
  properties: Property[]
  itemsFor: (p: Property) => MenuItem[]
}

export function PropertyTable({ properties, itemsFor }: PropertyTableProps) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Property</th>
            <th scope="col" className={styles.hideMd}>Type</th>
            <th scope="col" className={`${styles.num} ${styles.hideMd}`}>Beds</th>
            <th scope="col" className={`${styles.num} ${styles.hideSm}`}>Rent</th>
            <th scope="col" className={styles.hideSm}>Status</th>
            <th scope="col" className={styles.hideLg}>Added</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {properties.map((p) => {
            const img = coverUrl(p)
            return (
              <tr key={p.id}>
                <td>
                  <div className={styles.property}>
                    <span className={styles.thumb}>
                      {img
                        ? <img src={img} alt="" loading="lazy" width={56} height={42} />
                        : <ImageOff size={16} aria-hidden="true" />}
                    </span>
                    <div className={styles.propertyText}>
                      <Link to={`/properties/${p.id}`} className={styles.title}>{p.title}</Link>
                      <span className={styles.place}>{placeOf(p)}</span>
                      <span className={styles.mobileMeta}>
                        <ListingStatusBadge property={p} />
                        <VisibilityToggle property={p} />
                        <span className={styles.mobileRent}>{p.price ? formatRent(p) : 'No rent set'}</span>
                      </span>
                    </div>
                  </div>
                </td>
                <td className={`${styles.cap} ${styles.hideMd}`}>{p.propertyType}</td>
                <td className={`${styles.num} ${styles.hideMd}`}>{p.bedrooms ?? '—'}</td>
                <td className={`${styles.num} ${styles.rent} ${styles.hideSm}`}>{formatRent(p)}</td>
                <td className={styles.hideSm}>
                  <span className={styles.badges}><ListingStatusBadge property={p} /><VisibilityToggle property={p} /></span>
                </td>
                <td className={`${styles.muted} ${styles.hideLg}`}>{formatDate(p.createdAt)}</td>
                <td className={styles.actions}>
                  <Menu
                    label={`Actions for ${p.title}`}
                    triggerClassName={styles.actionBtn}
                    trigger={<EllipsisVertical size={16} aria-hidden="true" />}
                    items={itemsFor(p)}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function PropertyTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className={styles.wrap} aria-busy="true" aria-label="Loading properties">
      <table className={styles.table}>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              <td>
                <div className={styles.property}>
                  <Skeleton width={56} height={42} radius={6} />
                  <div className={styles.propertyText}>
                    <Skeleton width={180} height={12} />
                    <Skeleton width={110} height={10} />
                  </div>
                </div>
              </td>
              <td className={styles.hideMd}><Skeleton width={60} height={10} /></td>
              <td className={styles.hideSm}><Skeleton width={70} height={10} /></td>
              <td className={styles.hideSm}><Skeleton width={56} height={18} radius={999} /></td>
              <td className={styles.hideLg}><Skeleton width={80} height={10} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
