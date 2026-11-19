import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { riseAfter, useEntranceInitial } from '@/shared/motion'
import { LISTING_STATUSES, STATUS_META, type ListingStatus } from '../listingStatus'
import type { ListingType } from '../property.types'
import styles from './PropertyFilters.module.css'

export interface FilterState {
  search: string
  status: ListingStatus | ''
  listingType: ListingType | ''
  propertyType: string
}

export const EMPTY_FILTERS: FilterState = { search: '', status: '', listingType: '', propertyType: '' }

interface PropertyFiltersProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  counts: Record<ListingStatus | 'all', number>
  trailing?: ReactNode
  /**
   * Phones: search lives in the page header, status stays as chips and the dropdowns open from
   * the header's filter button. Wider screens: one toolbar with search and dropdowns.
   */
  phoneHero?: boolean
  phoneFiltersOpen?: boolean
}

const toolbarIn = riseAfter(0.2)

const PROPERTY_TYPES = ['apartment', 'house', 'villa', 'plot', 'commercial']

export function PropertyFilters({ filters, onChange, counts, trailing, phoneHero = false, phoneFiltersOpen = false }: PropertyFiltersProps) {
  const entranceInitial = useEntranceInitial()
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })
  const dirty = !!(filters.search || filters.status || filters.listingType || filters.propertyType)

  const tabs: { value: ListingStatus | ''; label: string; count: number }[] = [
    { value: '', label: 'All', count: counts.all },
    ...LISTING_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label, count: counts[s] })),
  ]

  return (
    <motion.div
      className={`${styles.wrap} ${phoneHero ? styles.heroMode : ''} ${phoneFiltersOpen ? styles.open : ''}`}
      variants={toolbarIn}
      initial={entranceInitial}
      animate="show"
    >
      <div className={styles.tabs} role="group" aria-label="Filter by status">
        {tabs.map((t) => {
          const active = filters.status === t.value
          return (
            <button
              key={t.label}
              type="button"
              aria-pressed={active}
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              onClick={() => set({ status: t.value })}
            >
              {t.label}
              <span className={styles.tabCount}>{t.count}</span>
            </button>
          )
        })}
      </div>

      <div className={styles.bar}>
        <div className={styles.searchWrap}>
          <Search size={18} aria-hidden="true" className={styles.searchIcon} />
          <input
            className={styles.search}
            type="search"
            name="search"
            placeholder="Search by title or location…"
            aria-label="Search properties"
            autoComplete="off"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>

        <select
          className={`${styles.select} ${styles.statusSelect}`}
          aria-label="Status"
          value={filters.status}
          onChange={(e) => set({ status: e.target.value as ListingStatus | '' })}
        >
          {tabs.map((t) => (
            <option key={t.label} value={t.value}>
              {t.value ? `${t.label} (${t.count})` : `All statuses (${t.count})`}
            </option>
          ))}
        </select>

        <select
          className={styles.select}
          aria-label="Property type"
          value={filters.propertyType}
          onChange={(e) => set({ propertyType: e.target.value })}
        >
          <option value="">All types</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>

        <select
          className={styles.select}
          aria-label="Listing type"
          value={filters.listingType}
          onChange={(e) => set({ listingType: e.target.value as ListingType | '' })}
        >
          <option value="">Rent & sale</option>
          <option value="rent">For rent</option>
          <option value="sale">For sale</option>
        </select>

        {dirty && (
          <button
            type="button"
            className={styles.clear}
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            <X size={14} aria-hidden="true" />
            Clear
          </button>
        )}

        {trailing && <div className={styles.trailing}>{trailing}</div>}
      </div>
    </motion.div>
  )
}
