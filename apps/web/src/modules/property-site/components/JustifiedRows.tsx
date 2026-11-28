import type { CSSProperties, ReactNode } from 'react'
import { justifiedRows } from '../listingContent'
import styles from '../PropertySitePage.module.css'
import { useMinWidth } from './useMinWidth'

/** Sum of aspect ratios each row aims for: higher means shorter rows. Wider screens fit more per row. */
const PHONE_TARGET = 2
const WIDE_TARGET = 3
/** The tallest a lone photo gets: most of a screen, but never huge on a big monitor. */
const LONE_MAX_HEIGHT = 'min(70svh, 560px)'

interface JustifiedRowsProps {
  /** Width ÷ height of each item, in order. */
  ratios: number[]
  className?: string
  /** Renders item `i`; `style` sizes it to its row, so put it on the item's outer element. */
  renderItem: (i: number, style: CSSProperties) => ReactNode
}

/** Lays items out in rows of one shared height, each as wide as its shape needs, so nothing is cropped. */
export function JustifiedRows({ ratios, className, renderItem }: JustifiedRowsProps) {
  const wide = useMinWidth(761)
  const rows = justifiedRows(ratios, wide ? WIDE_TARGET : PHONE_TARGET)

  // A lone photo has no neighbours to share a row with: shown whole and centred, as wide as its shape allows up to
  // a sensible height. Left to the row rules it would be a narrow tile with empty space beside it, or a full-width
  // photo several screens tall.
  if (ratios.length === 1) {
    const ratio = ratios[0]
    return (
      <div className={`${styles.rows} ${className ?? ''}`}>
        <div className={styles.row} style={{ justifyContent: 'center' }}>
          {renderItem(0, { flex: '0 1 auto', aspectRatio: String(ratio), width: `min(100%, calc(${LONE_MAX_HEIGHT} * ${ratio}))` })}
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.rows} ${className ?? ''}`}>
      {rows.map((row) => (
        <div key={row.items[0]} className={styles.row} style={row.span < 1 ? { width: `${row.span * 100}%` } : undefined}>
          {row.items.map((i) => renderItem(i, { flex: `${ratios[i]} 1 0`, aspectRatio: String(ratios[i]) }))}
        </div>
      ))}
    </div>
  )
}
