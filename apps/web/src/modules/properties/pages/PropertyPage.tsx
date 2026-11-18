import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { AppShell } from '@/shared/components/AppShell/AppShell'
import { Button } from '@/shared/components/Button'
import { StatusBadge, ListingTypeBadge } from '@/shared/components/Badge'
import { PropertyForm } from '../components/PropertyForm'
import { MediaGallery } from '../components/MediaGallery'
import { useProperty } from '../hooks/useProperty'
import { useUpdateProperty, useDeleteProperty } from '../hooks/usePropertyMutations'
import type { UpdatePropertyInput } from '../property.types'
import styles from './PropertyPage.module.css'

type Tab = 'details' | 'media'

export default function PropertyPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('details')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: property, isLoading, refetch } = useProperty(id)
  const { mutateAsync: update, isPending: saving } = useUpdateProperty(id!)
  const { mutateAsync: remove, isPending: deleting } = useDeleteProperty()

  async function handleSave(data: UpdatePropertyInput) {
    await update(data)
  }

  async function handleStatusChange(status: 'available' | 'sold' | 'rented') {
    await update({ status })
  }

  async function handleDelete() {
    await remove(id!)
    navigate('/properties')
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className={styles.center}><div className="spinner" /></div>
      </AppShell>
    )
  }

  if (!property) {
    return (
      <AppShell>
        <div className={styles.center}>
          <p>Property not found. <Link to="/properties">Go back</Link></p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className={styles.root}>
        {/* Page header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <Link to="/properties" className={styles.back}>← Properties</Link>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{property.title}</h1>
              <StatusBadge status={property.status} />
              <ListingTypeBadge type={property.listingType} />
            </div>
            <p className={styles.slug}>/p/{property.slug}</p>
          </div>

          <div className={styles.headerRight}>
            {/* Status switcher */}
            <div className={styles.statusMenu}>
              {(['available', 'sold', 'rented'] as const).map((s) => (
                <button
                  key={s}
                  className={`${styles.statusBtn} ${property.status === s ? styles.statusActive : ''}`}
                  onClick={() => handleStatusChange(s)}
                >
                  {capitalize(s)}
                </button>
              ))}
            </div>

            <a
              href={`/p/${property.slug}`}
              target="_blank"
              rel="noreferrer"
              className={styles.viewBtn}
            >
              View page ↗
            </a>
          </div>
        </header>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'details' ? styles.tabActive : ''}`}
            onClick={() => setTab('details')}
          >
            Details
          </button>
          <button
            className={`${styles.tab} ${tab === 'media' ? styles.tabActive : ''}`}
            onClick={() => setTab('media')}
          >
            Media
            {property.media.length > 0 && (
              <span className={styles.mediaBadge}>{property.media.length}</span>
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className={styles.body}>
          {tab === 'details' && (
            <PropertyForm
              initialValues={property}
              onSubmit={handleSave}
              submitLabel="Save Changes"
              isLoading={saving}
            />
          )}

          {tab === 'media' && (
            <MediaGallery
              propertyId={property.id}
              media={property.media}
              onUpdate={() => refetch()}
            />
          )}
        </div>

        {/* Danger zone */}
        <div className={styles.danger}>
          <div>
            <p className={styles.dangerTitle}>Delete Property</p>
            <p className={styles.dangerSub}>This is permanent and cannot be undone.</p>
          </div>
          {confirmDelete ? (
            <div className={styles.dangerConfirm}>
              <span className={styles.dangerWarning}>Are you sure?</span>
              <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
                Yes, delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
