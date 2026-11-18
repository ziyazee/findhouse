import styles from './StatCard.module.css'

interface StatCardProps {
  label: string
  value: number | string
  accent?: string
  sub?: string
  icon?: React.ReactNode
}

export function StatCard({ label, value, accent = 'var(--color-accent)', sub, icon }: StatCardProps) {
  return (
    <div className={styles.card} style={{ '--accent': accent } as React.CSSProperties}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>
      <p className={styles.value}>{value}</p>
      {sub && <p className={styles.sub}>{sub}</p>}
    </div>
  )
}
