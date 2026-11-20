import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { easeOut } from '@/shared/motion'
import styles from '../PropertySitePage.module.css'

export function Section({ title, aside, className, children }: { title: string; aside?: string; className?: string; children: ReactNode }) {
  return (
    <motion.section
      className={`${styles.section} ${className ?? ''}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      transition={{ duration: 0.5, ease: easeOut }}
    >
      <div className={styles.sectionHead}>
        <h2>{title}</h2>
        {aside && <span>{aside}</span>}
      </div>
      {children}
    </motion.section>
  )
}
