import type { ReactNode } from 'react'
import styles from './Card.module.css'

interface CardProps {
  children: ReactNode
  className?: string
  padded?: boolean
  id?: string
}

export function Card({ children, className = '', padded = false, id }: CardProps) {
  return <section id={id} className={`${styles.card} ${padded ? styles.padded : ''} ${className}`}>{children}</section>
}

interface CardHeaderProps {
  title: string
  description?: ReactNode
  action?: ReactNode
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headText}>
        <h2 className={styles.title}>{title}</h2>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </header>
  )
}

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: ReactNode
  action?: ReactNode
  compact?: boolean
}

export function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div className={`${styles.empty} ${compact ? styles.emptyCompact : ''}`}>
      <span className={styles.emptyIcon} aria-hidden="true">{icon}</span>
      <h3 className={styles.emptyTitle}>{title}</h3>
      <p className={styles.emptyText}>{description}</p>
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  )
}

export function Skeleton({ width, height = 14, radius, className = '' }: {
  width?: number | string
  height?: number | string
  radius?: number
  className?: string
}) {
  return (
    <span
      className={`${styles.skeleton} ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}
