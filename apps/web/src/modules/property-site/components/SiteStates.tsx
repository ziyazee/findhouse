import { motion } from 'framer-motion'
import { Home } from 'lucide-react'
import { easeOut } from '@/shared/motion'
import logoMark from '@/assets/logo-mark.png'
import styles from '../PropertySitePage.module.css'

/** Placeholder with the page's shape while the listing loads. */
export function Loading() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading this home">
      <div className={`${styles.hero} ${styles.heroLoading}`} />
      <main className={styles.main}>
        <div className={`${styles.summary} ${styles.summaryLoading}`}>
          <span className={styles.shimmer} style={{ width: 120, height: 12 }} />
          <span className={styles.shimmer} style={{ width: 220, height: 30 }} />
          <span className={styles.shimmer} style={{ width: '100%', height: 84 }} />
        </div>
      </main>
    </div>
  )
}

/** No listing to show: removed, never existed, or (when `failed`) couldn’t be fetched. */
export function Unavailable({ failed }: { failed: boolean }) {
  return (
    <div className={styles.missing}>
      <span className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true"><img src={logoMark} alt="" /></span>
        FindHouse
      </span>
      <motion.div className={styles.missingCard} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut }}>
        <span className={styles.missingIcon} aria-hidden="true"><Home size={26} /></span>
        {failed ? (
          <>
            <h1>We couldn’t load this home</h1>
            <p>Check your connection and refresh the page. If it keeps happening, ask the agent who shared it for a new link.</p>
          </>
        ) : (
          <>
            <h1>This home is no longer listed</h1>
            <p>It may have been rented or sold, or the link may be incomplete. Ask the agent who shared it for the latest options.</p>
          </>
        )}
      </motion.div>
    </div>
  )
}
