import { type ReactNode } from 'react'
import styles from './AuthLayout.module.css'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={styles.root}>
      {/* Left brand panel */}
      <aside className={styles.brand} aria-hidden="true">
        <div className={styles.brandInner}>
          <div className={styles.logo}>
            <HouseIcon />
            <span className={styles.logoName}>Find House</span>
          </div>

          <div className={styles.brandBody}>
            <p className={styles.brandHeadline}>
              Property management, simplified.
            </p>
            <p className={styles.brandSub}>
              Send property details on WhatsApp. Get a shareable listing page in minutes.
            </p>
          </div>

          <div className={styles.brandStats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>WhatsApp</span>
              <span className={styles.statLabel}>first workflow</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>Auto</span>
              <span className={styles.statLabel}>property pages</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>AI</span>
              <span className={styles.statLabel}>data extraction</span>
            </div>
          </div>

          {/* Decorative grid */}
          <div className={styles.grid} aria-hidden="true">
            {Array.from({ length: 48 }).map((_, i) => (
              <div key={i} className={styles.gridDot} />
            ))}
          </div>
        </div>
      </aside>

      {/* Right form panel */}
      <main className={styles.formPanel}>
        <div className={styles.formInner}>
          {/* Mobile-only logo */}
          <div className={styles.mobileLogo}>
            <HouseIcon />
            <span className={styles.logoName}>Find House</span>
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}

function HouseIcon() {
  return (
    <svg className={styles.houseIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
