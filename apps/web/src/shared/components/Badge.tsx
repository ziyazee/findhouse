import styles from './Badge.module.css'

export type BadgeVariant = 'green' | 'red' | 'amber' | 'blue' | 'grey' | 'tag'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  dot?: boolean
  title?: string
}

export function Badge({ children, variant = 'grey', size = 'md', dot = false, title }: BadgeProps) {
  return (
    <span
      className={`${styles.badge} ${styles[variant]} ${size === 'sm' ? styles.sm : ''}`}
      title={title}
    >
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  )
}

export function ListingTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="tag">
      {type === 'sale' ? 'For sale' : 'For rent'}
    </Badge>
  )
}
