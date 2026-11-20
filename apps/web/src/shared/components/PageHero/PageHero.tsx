import { useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import { ArrowLeft, Search } from 'lucide-react'
import logoMark from '@/assets/logo-mark.png'
import { PHONE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery'
import { easeOut, rise, useEntrance, useEntranceInitial, useIsLandingPage } from '../../motion'
import { PhoneBannerContext } from './phoneBanner'
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
  // On phones the banner fills the top of the screen, so fading it in after a tab switch reads as a flash.
  const isPhone = useMediaQuery(PHONE_QUERY)
  const landing = useIsLandingPage()
  const solidBanner = isPhone && !landing
  // Coming back to a phone tab the banner stays put, so only the new heading needs to settle in.
  const firstVisit = useEntrance()
  const headingMotion = isPhone && !back && !firstVisit
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.26, ease: easeOut } }
    : { variants: rise }
  const ref = useRef<HTMLElement>(null)
  const reportHeight = useContext(PhoneBannerContext)
  useLayoutEffect(() => {
    const el = ref.current
    if (!reportHeight || back || !el) return
    // Layout height, so an entrance transform doesn't skew it
    const report = () => reportHeight(el.offsetHeight)
    report()
    const observer = new ResizeObserver(report)
    observer.observe(el)
    return () => observer.disconnect()
  }, [reportHeight, back])

  const style = image ? ({ '--hero-image': `url("${image}")` } as CSSProperties) : undefined
  const cls = [styles.hero, image && styles.photo, back && styles.withBack, overlap && styles.overlap, className]
  return (
    <motion.section ref={ref} className={cls.filter(Boolean).join(' ')} style={style} variants={solidBanner ? bannerContent : banner} initial={entranceInitial} animate="show">
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
      {title && <motion.h1 className={styles.title} {...headingMotion}>{title}</motion.h1>}
      {subtitle && <motion.p className={styles.subtitle} {...headingMotion}>{subtitle}</motion.p>}
      {children}
    </motion.section>
  )
}

/**
 * Phone tab pages: the banner photo and brand, kept mounted by the shell so they stay still while
 * the page on top of it changes. Fades in once, when the workspace opens, and glides to the height
 * of each page's hero (`height`, reported through PhoneBannerContext).
 */
export function PhoneBanner({ height, className = '' }: { height: number | null; className?: string }) {
  // The first height arrives as the page mounts; only later changes should glide.
  const [sized, setSized] = useState(false)
  useEffect(() => { if (height !== null) setSized(true) }, [height])
  const style = height === null ? undefined : ({ '--banner-height': `${height}px` } as CSSProperties)
  return (
    <motion.div
      className={`${styles.phoneBanner} ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: easeOut }}
    >
      <div className={`${styles.phoneBannerArt} ${sized ? styles.glide : ''}`} style={style}>
        <div className={styles.top}>
          <Link to="/dashboard" className={styles.brand}>
            <img className={styles.mark} src={logoMark} alt="" aria-hidden="true" />
            FindHouse
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

const banner: Variants = {
  hidden: { opacity: 0, scale: 0.985 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: easeOut, staggerChildren: 0.08, delayChildren: 0.08 } },
}

/** `banner` without fading the panel itself: only its contents animate in. */
const bannerContent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } },
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
