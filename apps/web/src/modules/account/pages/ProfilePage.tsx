import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChartColumn, ChevronRight, Globe, House, Inbox, KeyRound, LifeBuoy, LogOut, Settings, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, Skeleton } from '@/shared/components/Card'
import { CountUp, Item, Reveal } from '@/shared/components/Motion'
import { pop, rise, stagger } from '@/shared/motion'
import { PageHero } from '@/shared/components/PageHero/PageHero'
import { heroGlassBtn } from '@/shared/components/PageHero/heroClasses'
import { useAuth, useSignOut } from '@/modules/auth/useAuth'
import { initials } from '@/shared/format'
import { useDashboardData } from '@/modules/dashboard/hooks/useDashboardData'
import { useMySite } from '@/modules/broker-site/useBrokerSite'
import styles from './ProfilePage.module.css'

export default function ProfilePage() {
  const { user } = useAuth()
  const handleLogout = useSignOut()
  const { isLoading, summary } = useDashboardData({ withIntake: false })
  const site = useMySite()

  const name = user?.name ?? 'Broker'
  const avatar = initials(name)

  return (
    <>
      <PageHero
        overlap
        actions={
          <Link to="/settings" className={heroGlassBtn} aria-label="Account settings">
            <Settings size={20} aria-hidden="true" />
          </Link>
        }
      >
        <div className={styles.heroIdentity}>
          <span className={styles.heroAvatar} aria-hidden="true">{avatar}</span>
          <div className={styles.heroText}>
            <h1 className={styles.heroName}>{name}</h1>
            <p className={styles.heroPhone}>+{user?.phone}</p>
            <span className={styles.heroChip}><span className={styles.dot} aria-hidden="true" />Active broker</span>
          </div>
        </div>
      </PageHero>

      <Reveal className={styles.stack} gap={0.12} delay={0.1}>
        <motion.section className={styles.stats} aria-label="Your properties" variants={stagger(0.08)}>
          <Stat to="/properties" tint="mint" icon={<House size={18} />} label="Properties" value={summary.total} loading={isLoading} />
          <Stat to="/properties?status=active" tint="green" icon={<Zap size={18} />} label="Active" value={summary.byStatus.active} loading={isLoading} />
          <Stat to="/properties?status=rented" tint="lavender" icon={<KeyRound size={18} />} label="Rented" value={summary.byStatus.rented} loading={isLoading} />
        </motion.section>

        <Item>
          <Card className={styles.menuCard}>
            <ul className={styles.menu}>
              {site.pageUrl && (
                <Row
                  href={site.pageUrl}
                  tint="peach"
                  icon={<Globe size={18} />}
                  title="Your public page"
                  text={site.subdomain ? site.pageUrl.replace(/^https?:\/\/|\/$/g, '') : 'Your public listings, to share with anyone'}
                />
              )}
              <Row to="/settings" tint="mint" icon={<Settings size={18} />} title="Account settings" text="Your details and preferences" />
              <Row to="/performance" tint="green" icon={<ChartColumn size={18} />} title="Performance" text="Occupancy and rent by area" />
              <Row to="/enquiries" tint="lavender" icon={<Inbox size={18} />} title="Enquiries" text="Messages from your property pages" />
              <Row to="/help" tint="peach" icon={<LifeBuoy size={18} />} title="Help & support" text="How listing from WhatsApp works" />
            </ul>
          </Card>
        </Item>

        <motion.button type="button" className={styles.signOut} onClick={handleLogout} variants={rise}>
          <LogOut size={18} aria-hidden="true" />
          Sign out
        </motion.button>
      </Reveal>
    </>
  )
}

type Tint = 'mint' | 'green' | 'lavender' | 'peach'

function Stat({ to, tint, icon, label, value, loading }: {
  to: string
  tint: Tint
  icon: ReactNode
  label: string
  value: number
  loading: boolean
}) {
  return (
    <motion.div className={styles.statItem} variants={pop}>
      <Link to={to} className={`${styles.stat} ${styles[`tint_${tint}`]}`}>
        <span className={styles.statIcon} aria-hidden="true">{icon}</span>
        <span className={styles.statValue}>{loading ? <Skeleton width={28} height={24} /> : <CountUp value={value} />}</span>
        <span className={styles.statLabel}>{label}</span>
      </Link>
    </motion.div>
  )
}

/** `to` for a workspace page; `href` for a link that opens in a new tab. */
function Row({ to, href, tint, icon, title, text }: {
  to?: string
  href?: string
  tint: Tint
  icon: ReactNode
  title: string
  text: string
}) {
  const content = (
    <>
      <span className={`${styles.rowIcon} ${styles[`tint_${tint}`]}`} aria-hidden="true">{icon}</span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowSub}>{text}</span>
      </span>
      <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
    </>
  )
  return (
    <li>
      {href
        ? <a href={href} target="_blank" rel="noreferrer" className={styles.row}>{content}</a>
        : <Link to={to ?? '/'} className={styles.row}>{content}</Link>}
    </li>
  )
}
