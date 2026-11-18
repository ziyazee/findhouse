import styles from './PropertyFilters.module.css'
import type { PropertyStatus, ListingType } from '../property.types'

export interface FilterState {
  search: string
  status: PropertyStatus | ''
  listingType: ListingType | ''
  propertyType: string
}

interface PropertyFiltersProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  total: number
}

const PROPERTY_TYPES = ['', 'apartment', 'house', 'villa', 'plot', 'commercial']

export function PropertyFilters({ filters, onChange, total }: PropertyFiltersProps) {
  function set(patch: Partial<FilterState>) {
    onChange({ ...filters, ...patch })
  }

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <div className={styles.searchWrap}>
          <SearchIcon />
          <input
            className={styles.search}
            type="search"
            placeholder="Search properties…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>

        <select
          className={styles.select}
          value={filters.status}
          onChange={(e) => set({ status: e.target.value as PropertyStatus | '' })}
        >
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="sold">Sold</option>
          <option value="rented">Rented</option>
        </select>

        <select
          className={styles.select}
          value={filters.listingType}
          onChange={(e) => set({ listingType: e.target.value as ListingType | '' })}
        >
          <option value="">Sale & Rent</option>
          <option value="sale">For Sale</option>
          <option value="rent">For Rent</option>
        </select>

        <select
          className={styles.select}
          value={filters.propertyType}
          onChange={(e) => set({ propertyType: e.target.value })}
        >
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>{t === '' ? 'All types' : capitalize(t)}</option>
          ))}
        </select>
      </div>

      <span className={styles.count}>{total} propert{total === 1 ? 'y' : 'ies'}</span>
    </div>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  )
}
