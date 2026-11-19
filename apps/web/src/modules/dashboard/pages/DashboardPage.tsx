import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, ArrowUp, Bell, Building2, CirclePlus, FilePen, House, KeyRound,
  SlidersHorizontal, TriangleAlert, Zap,
} from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { motion } from 'framer-motion'
import { Card, CardHeader, EmptyState, Skeleton } from '@/shared/components/Card'
import { CountUp } from '@/shared/components/Motion'
import { listItem, pop, riseAfter, stagger, useEntranceInitial } from '@/shared/motion'
import { HeroSearch, PageHero } from '@/shared/components/PageHero/PageHero'
import { heroGlassBtn, heroPhoneOnly, heroSquareBtn } from '@/shared/components/PageHero/heroClasses'
import { useAuth } from '@/modules/auth/useAuth'
import { PropertyCard, PropertyCardSkeleton } from '@/modules/properties/components/PropertyCard'
import { useDashboardData } from '../hooks/useDashboardData'
import styles from './DashboardPage.module.css'

export default function DashboardPage() {
  const entranceInitial = useEntranceInitial()
  const { user } = useAuth()
  const { isLoading, isError, refetch, summary, properties } = useDashboardData({ withIntake: false })
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const firstName = user?.name?.split(' ')[0]
  const recent = properties.slice(0, 6)

  function handleSearch() {
    const q = query.trim()
    navigate(q ? `/properties?q=${encodeURIComponent(q)}` : '/properties')
  }

  return (
    <>
      <PageHero
        overlap
        title={<span className={styles.greeting}>{getGreeting()}{firstName && <>, <span className={styles.heroName}>{firstName}</span></>}{' '}<span aria-hidden="true">👋</span></span>}
        subtitle="Here’s how your properties are doing today."
        actions={
          <Link to="/enquiries" className={`${heroGlassBtn} ${heroPhoneOnly}`} aria-label="Enquiries">
            <Bell size={20} aria-hidden="true" />
          </Link>
        }
      >
        <HeroSearch
          value={query}
          onChange={setQuery}
          onSubmit={handleSearch}
          placeholder="Search by title or area"
          label="Search properties by title or location"
          trailing={
            <Link to="/properties" className={`${heroSquareBtn} ${heroPhoneOnly}`} aria-label="Filter properties">
              <SlidersHorizontal size={20} aria-hidden="true" />
            </Link>
          }
        />
      </PageHero>

      {isError ? (
        <Card>
          <EmptyState
            icon={<TriangleAlert size={20} />}
            title="Couldn’t load your dashboard"
            description="Check your connection and try again."
            action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>}
          />
        </Card>
      ) : (
        <>
          <motion.section className={styles.stats} aria-label="Key figures" variants={stagger(0.08, 0.15)} initial={entranceInitial} animate="show">
            <Stat
              to="/properties"
              icon={<House size={18} />}
              label={<><span className={styles.labelLong}>Total properties</span><span className={styles.labelShort}>Properties</span></>}
              value={summary.total}
              sub={summary.addedThisMonth
                ? <span className={styles.trend}><ArrowUp size={12} aria-hidden="true" />+{summary.addedThisMonth} this month</span>
                : 'None added this month'}
              tint="mint"
              loading={isLoading}
            />
            <Stat
              to="/properties?status=active"
              icon={<Zap size={18} />}
              label="Active"
              value={summary.byStatus.active}
              sub="Live and ready to share"
              tint="green"
              loading={isLoading}
            />
            <Stat
              to="/properties?status=rented"
              icon={<KeyRound size={18} />}
              label="Rented"
              value={summary.byStatus.rented}
              sub={`${Math.round(summary.occupancy * 100)}% of your rentals`}
              tint="lavender"
              loading={isLoading}
            />
            <Stat
              to="/properties?status=draft"
              icon={<FilePen size={18} />}
              label="Drafts"
              value={summary.byStatus.draft}
              sub={summary.byStatus.draft ? 'Missing rent or photos' : 'Nothing to finish'}
              tone={summary.byStatus.draft ? 'warn' : undefined}
              tint="peach"
              loading={isLoading}
            />
          </motion.section>

          <motion.div variants={recentIn} initial={entranceInitial} animate="show">
            <Card className={styles.recentCard}>
              <CardHeader
                title="Recently added"
                description="Your newest properties"
                action={<Link to="/properties" className={styles.headerLink}>View all <ArrowRight size={14} aria-hidden="true" /></Link>}
              />
              {(isLoading || recent.length > 0) && (
                <div className={styles.recentGrid}>
                  {isLoading
                    ? Array.from({ length: 3 }, (_, i) => <PropertyCardSkeleton key={i} />)
                    : recent.map((p, i) => (
                      <motion.div key={p.id} className={styles.recentItem} variants={listItem} custom={i}>
                        <PropertyCard property={p} compact />
                      </motion.div>
                    ))}
                </div>
              )}
              {!isLoading && recent.length === 0 && (
                <EmptyState
                  compact
                  icon={<Building2 size={20} />}
                  title="No properties yet"
                  description="Add your first property, or send its photos and details to your FindHouse WhatsApp number."
                  action={<Button as={Link} to="/properties/new"><CirclePlus size={16} aria-hidden="true" />Add property</Button>}
                />
              )}
            </Card>
          </motion.div>
        </>
      )}

    </>
  )
}

function Stat({ to, icon, label, value, sub, tone, tint, loading }: {
  to: string
  icon: ReactNode
  label: ReactNode
  value: number
  sub: ReactNode
  tone?: 'warn'
  tint: 'mint' | 'green' | 'lavender' | 'peach'
  loading: boolean
}) {
  return (
    <motion.div className={styles.statItem} variants={pop}>
      <Link to={to} className={`${styles.stat} ${styles[`tint_${tint}`]}`}>
        <span className={styles.statLabel}>{label}</span>
        <span className={`${styles.statIcon} ${tone === 'warn' ? styles.statIconWarn : ''}`} aria-hidden="true">{icon}</span>
        <span className={styles.statValue}>{loading ? <Skeleton width={56} height={30} /> : <CountUp value={value} />}</span>
        <span className={`${styles.statSub} ${tone === 'warn' ? styles.statSubWarn : ''}`}>{loading ? '\u00a0' : sub}</span>
      </Link>
    </motion.div>
  )
}

const recentIn = riseAfter(0.45)

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
