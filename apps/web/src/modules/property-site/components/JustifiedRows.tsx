import type { CSSProperties, ReactNode } from 'react'
import { justifiedRows } from '../listingContent'
import styles from '../PropertySitePage.module.css'
import { useMinWidth } from './useMinWidth'

/** Sum of aspect ratios each row aims for: higher means shorter rows. Wider screens fit more per row. */
const PHONE_TARGET = 2
const WIDE_TARGET = 3

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
