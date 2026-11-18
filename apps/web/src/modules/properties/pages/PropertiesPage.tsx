import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/shared/components/AppShell/AppShell'
import { Button } from '@/shared/components/Button'
import { PropertyCard } from '../components/PropertyCard'
import { PropertyFilters, type FilterState } from '../components/PropertyFilters'
import { useProperties } from '../hooks/useProperties'
import styles from './PropertiesPage.module.css'

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: '',
  listingType: '',
  propertyType: '',
}

export default function PropertiesPage() {
  const { data: properties = [], isLoading, isError } = useProperties()
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (
          !p.title.toLowerCase().includes(q) &&
          !p.location?.toLowerCase().includes(q) &&
          !p.locality?.toLowerCase().includes(q)
        ) return false
      }
      if (filters.status && p.status !== filters.status) return false
      if (filters.listingType && p.listingType !== filters.listingType) return false
      if (filters.propertyType && p.propertyType !== filters.propertyType) return false
      return true
    })
  }, [properties, filters])

  return (
    <AppShell>
      <div className={styles.root}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Properties</h1>
            <p className={styles.sub}>Manage your listings</p>
          </div>
          <Button as={Link} to="/properties/new" variant="primary">
            + New Property
          </Button>
        </header>

        <div className={styles.filters}>
          <PropertyFilters
            filters={filters}
            onChange={setFilters}
            total={filtered.length}
          />
        </div>

        {isLoading ? (
          <div className={styles.center}><div className="spinner" /></div>
        ) : isError ? (
          <div className={styles.center}>
            <p className={styles.errorMsg}>Failed to load properties.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <BuildingIcon />
            <p>
              {properties.length === 0
                ? 'No properties yet. Create one manually or send a WhatsApp message.'
                : 'No properties match your filters.'}
            </p>
            {properties.length === 0 && (
              <Button as={Link} to="/properties/new" variant="primary">
                + New Property
              </Button>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function BuildingIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-fg3)' }}>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    </svg>
  )
}
