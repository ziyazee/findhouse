import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import { ArrowLeft, Search } from 'lucide-react'
import logoMark from '@/assets/logo-mark.png'
import { easeOut, rise, useEntranceInitial } from '../../motion'
import styles from './PageHero.module.css'

interface PageHeroProps {
  title?: ReactNode
  subtitle?: ReactNode
  /** Shows a back button (in place of the brand on phones). */
  back?: { to: string; label: string }
  actions?: ReactNode
  children?: ReactNode
  /** Background photo; defaults to the brand building image. */
  image?: string | null
  /** Leaves room at the bottom for content that overlaps the banner. */
  overlap?: boolean
  className?: string
}

/** Green photo banner that heads every broker page. */
export function PageHero({ title, subtitle, back, actions, children, image, overlap = false, className = '' }: PageHeroProps) {
  const entranceInitial = useEntranceInitial()
  const style = image ? ({ '--hero-image': `url("${image}")` } as CSSProperties) : undefined
  const cls = [styles.hero, image && styles.photo, back && styles.withBack, overlap && styles.overlap, className]
  return (
    <motion.section className={cls.filter(Boolean).join(' ')} style={style} variants={banner} initial={entranceInitial} animate="show">
      <motion.div className={styles.top} variants={fade}>
        {back ? (
          <Link to={back.to} className={styles.glassBtn} aria-label={back.label}>
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        ) : (
          <Link to="/dashboard" className={styles.brand}>
            <img className={styles.mark} src={logoMark} alt="" aria-hidden="true" />
            FindHouse
          </Link>
        )}
        {actions && <div className={styles.actions}>{actions}</div>}
      </motion.div>
      {title && <motion.h1 className={styles.title} variants={rise}>{title}</motion.h1>}
      {subtitle && <motion.p className={styles.subtitle} variants={rise}>{subtitle}</motion.p>}
      {children}
    </motion.section>
  )
}

const banner: Variants = {
  hidden: { opacity: 0, scale: 0.985 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: easeOut, staggerChildren: 0.08, delayChildren: 0.08 } },
}

const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4 } },
}

interface HeroSearchProps {
  value: string
  onChange: (v: string) => void
  onSubmit?: () => void
  placeholder?: string
  label: string
  trailing?: ReactNode
  className?: string
}

export function HeroSearch({ value, onChange, onSubmit, placeholder, label, trailing, className = '' }: HeroSearchProps) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit?.()
  }
  return (
    <motion.div className={`${styles.searchRow} ${className}`} variants={rise}>
      <form className={styles.search} onSubmit={handleSubmit} role="search">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          autoComplete="off"
        />
      </form>
      {trailing}
    </motion.div>
  )
}
