import styles from './Badge.module.css'

type BadgeVariant = 'green' | 'red' | 'amber' | 'blue' | 'grey'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
}

export function Badge({ children, variant = 'grey', size = 'md' }: BadgeProps) {
  return (
    <span
      className={`${styles.badge} ${styles[variant]} ${size === 'sm' ? styles.sm : ''}`}
    >
      {children}
    </span>
  )
}

// Preset helpers used across the dashboard
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    available: 'green',
    sold: 'red',
    rented: 'blue',
  }
  const labels: Record<string, string> = {
    available: 'Available',
    sold: 'Sold',
    rented: 'Rented',
  }
  return <Badge variant={map[status] ?? 'grey'}>{labels[status] ?? status}</Badge>
}

export function ListingTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant={type === 'sale' ? 'amber' : 'blue'}>
      {type === 'sale' ? 'For Sale' : 'For Rent'}
    </Badge>
  )
}
