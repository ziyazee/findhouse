import { useMemo, useState } from 'react'
import { Expand, Play } from 'lucide-react'
import { getMediaUrl } from '@/lib/storage'
import type { PropertyMedia } from '@/modules/properties/property.types'
import { galleryGroups, gridIndexes, mediaCount, photoAlt, roomLabel } from '../listingContent'
import { JustifiedRows } from './JustifiedRows'
import { rememberOrigin } from './openOrigin'
import { useMediaRatios } from './useMediaRatios'
import styles from '../PropertySitePage.module.css'

const GRID_MAX = 5

interface PhotoGridProps {
  items: PropertyMedia[]
  title: string
  onOpen: (index: number) => void
  /** Opens the full gallery, from the "+N more" tile. */
  onShowAll: () => void
}

export function PhotoGrid({ items, title, onOpen, onShowAll }: PhotoGridProps) {
  const groups = useMemo(() => galleryGroups(items), [items])
  const [filter, setFilter] = useState<string | null>(null)
  const group = groups.find((g) => g.label === filter)
  const start = group?.start ?? 0
  const pool = group ? items.slice(group.start, group.start + group.count) : items
  const shown = gridIndexes(pool, GRID_MAX).map((i) => start + i)
  const extra = pool.length - shown.length
  const ratioOf = useMediaRatios(items)

  return (
    <>
      {groups.length > 1 && (
        <div className={styles.filters} role="group" aria-label="Show photos of">
          <FilterChip label="All" count={items.length} active={!group} onSelect={() => setFilter(null)} />
          {groups.map((g) => (
            <FilterChip key={g.label} label={g.label} count={g.count} active={g === group} onSelect={() => setFilter(g.label)} />
          ))}
        </div>
      )}
      <JustifiedRows
        key={filter ?? ''}
        className={styles.grid}
        ratios={shown.map((i) => ratioOf(items[i]))}
        renderItem={(slot, style) => {
          const index = shown[slot]
          const m = items[index]
          const more = slot === shown.length - 1 && extra > 0
          const video = m.mediaType === 'video'
          return (
            <button
              key={m.id}
              type="button"
              className={styles.tile}
              style={style}
              data-photo-index={more ? undefined : index}
              onClick={(e) => {
                if (more) return onShowAll()
                rememberOrigin(index, e.currentTarget)
                onOpen(index)
              }}
              aria-label={more ? `View all ${mediaCount(items)}` : video ? 'Play video' : `Open photo ${index + 1} of ${items.length}`}
            >
              {video ? (
                // `#t=0.1` makes Safari paint the first frame instead of a blank box.
                <video src={`${getMediaUrl(m.storagePath)}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} aria-hidden="true" />
              ) : (
                <img src={getMediaUrl(m.storagePath)} alt={photoAlt(m, title)} loading="lazy" />
              )}
              {video && !more && <span className={styles.tilePlay} aria-hidden="true"><Play size={22} fill="currentColor" /></span>}
              {!video && !group && !more && roomLabel(m) && <span className={styles.tileTag}>{roomLabel(m)}</span>}
              {more && <span className={styles.tileMore}>+{extra}<small>more</small></span>}
              {!video && !more && <span className={styles.tileZoom} aria-hidden="true"><Expand size={14} /></span>}
            </button>
          )
        }}
      />
    </>
  )
}

function FilterChip({ label, count, active, onSelect }: { label: string; count: number; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={styles.filter} aria-pressed={active} onClick={onSelect}>
      {label}<span>{count}</span>
    </button>
  )
}
