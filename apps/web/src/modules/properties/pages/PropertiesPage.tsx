import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Building2, LayoutGrid, List, Plus, SearchX, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { motion } from 'framer-motion'
import { Card, EmptyState } from '@/shared/components/Card'
import { listItem, riseAfter, useEntranceInitial } from '@/shared/motion'
import { HeroSearch, PageHero } from '@/shared/components/PageHero/PageHero'
import { heroPhoneOnly, heroSquareBtn } from '@/shared/components/PageHero/heroClasses'
import { PHONE_QUERY, useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { PropertyCard, PropertyCardSkeleton } from '../components/PropertyCard'
import { PropertyFilters } from '../components/PropertyFilters'
import { PropertyTable, PropertyTableSkeleton } from '../components/PropertyTable'
import { usePropertyActions } from '../components/usePropertyActions'
import { useProperties } from '../hooks/useProperties'
import { EMPTY_FILTERS, countByStatus, filterProperties, parseStatus, type FilterState } from '../propertyFilters'
import { setPropertiesView, usePropertiesView, type PropertiesView } from '../viewPreference'
import styles from './PropertiesPage.module.css'

export default function PropertiesPage() {
  const entranceInitial = useEntranceInitial()
  const { data: properties = [], isLoading, isError, refetch } = useProperties()
  const [params] = useSearchParams()
  const [filters, setFilters] = useState<FilterState>({
    ...EMPTY_FILTERS,
    search: params.get('q') ?? '',
    status: parseStatus(params.get('status')),
  })
  const savedView = usePropertiesView()
  const isPhone = useMediaQuery(PHONE_QUERY)
  const view: PropertiesView = isPhone ? 'grid' : savedView
  const [filtersOpen, setFiltersOpen] = useState(false)
  const actions = usePropertyActions()
  const q = params.get('q')

  useEffect(() => {
    if (q !== null) setFilters((f) => ({ ...f, search: q }))
  }, [q])

  const counts = useMemo(() => countByStatus(properties), [properties])
  const filtered = useMemo(() => filterProperties(properties, filters), [properties, filters])

  const viewToggle = (
    <div className={styles.viewToggle} role="group" aria-label="Layout">
      <button type="button" aria-pressed={view === 'table'} aria-label="List view" onClick={() => setPropertiesView('table')}>
        <List size={16} aria-hidden="true" />
      </button>
      <button type="button" aria-pressed={view === 'grid'} aria-label="Grid view" onClick={() => setPropertiesView('grid')}>
        <LayoutGrid size={16} aria-hidden="true" />
      </button>
    </div>
  )

  const summary = isLoading ? 'Loading…' : `${properties.length} ${properties.length === 1 ? 'property' : 'properties'} · ${counts.active} active`

  let body
  if (isLoading) {
    body = view === 'table'
      ? <Card><PropertyTableSkeleton rows={6} /></Card>
      : <div className={styles.grid}>{Array.from({ length: 6 }, (_, i) => <PropertyCardSkeleton key={i} />)}</div>
  } else if (isError) {
    body = (
      <Card>
        <EmptyState
          icon={<TriangleAlert size={20} />}
          title="Couldn’t load your properties"
          description="Check your connection and try again."
          action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>}
        />
      </Card>
    )
  } else if (properties.length === 0) {
    body = (
      <Card>
        <EmptyState
          icon={<Building2 size={20} />}
          title="No properties yet"
          description="Add a property here, or send photos and details to your FindHouse WhatsApp number and reply “done”."
          action={<Button as={Link} to="/properties/new"><Plus size={16} aria-hidden="true" />Add property</Button>}
        />
      </Card>
    )
  } else if (filtered.length === 0) {
    body = (
      <Card>
        <EmptyState
          icon={<SearchX size={20} />}
          title="No properties match"
          description="Try a different search or clear the filters."
          action={<Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>Clear all filters</Button>}
        />
      </Card>
    )
  } else if (view === 'table') {
    body = (
      <motion.div key="table" variants={listIn} initial={entranceInitial} animate="show">
        <Card><PropertyTable properties={filtered} itemsFor={(p) => actions.itemsFor(p)} /></Card>
      </motion.div>
    )
  } else {
    body = (
      <motion.div key="grid" className={styles.grid} initial={entranceInitial} animate="show">
        {filtered.map((p, i) => (
          <motion.div key={p.id} className={styles.gridItem} variants={listItem} custom={i + 4}>
            <PropertyCard property={p} menuItems={actions.itemsFor(p)} shareOnPhone onStatusChange={(status) => actions.changeStatus(p, status)} />
          </motion.div>
        ))}
      </motion.div>
    )
  }

  return (
    <>
      <PageHero
        overlap
        title="My properties"
        subtitle={summary}
      >
        <HeroSearch
          value={filters.search}
          onChange={(search) => setFilters((f) => ({ ...f, search }))}
          placeholder="Search by title or area"
          label="Search properties by title or location"
          className={heroPhoneOnly}
          trailing={
            <button
              type="button"
              className={heroSquareBtn}
              aria-label="Filters"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal size={20} aria-hidden="true" />
              {(filters.listingType || filters.propertyType) && <span className={styles.filterDot} aria-hidden="true" />}
            </button>
          }
        />
      </PageHero>

      <PropertyFilters
        filters={filters}
        onChange={setFilters}
        counts={counts}
        trailing={viewToggle}
        phoneHero
        phoneFiltersOpen={filtersOpen}
      />

      {!isLoading && filtered.length > 0 && filtered.length !== properties.length && (
        <p className={styles.resultCount} aria-live="polite">
          Showing {filtered.length} of {properties.length}
        </p>
      )}

      {body}
      {actions.dialog}
    </>
  )
}

const listIn = riseAfter(0.3)
