import { Link } from 'react-router-dom'
import { AppShell } from '@/shared/components/AppShell/AppShell'
import { Button } from '@/shared/components/Button'
import { StatCard } from '../components/StatCard'
import { RecentActivity } from '../components/RecentActivity'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useAuth } from '@/modules/auth/useAuth'
import styles from './DashboardPage.module.css'

export default function DashboardPage() {
  const { user } = useAuth()
  const { data: stats, isLoading } = useDashboardStats()

  const greeting = getGreeting()

  return (
    <AppShell>
      <div className={styles.root}>
        {/* Welcome */}
        <header className={styles.welcome}>
          <div>
            <h1 className={styles.title}>
              {greeting}, {user?.name?.split(' ')[0] ?? 'there'} 👋
            </h1>
            <p className={styles.sub}>Here's a summary of your listings.</p>
          </div>
          <Button as={Link} to="/properties/new" variant="primary">
            + New Property
          </Button>
        </header>

        {/* Stats grid */}
        {isLoading ? (
          <div className={styles.statsLoading}><div className="spinner" /></div>
        ) : stats ? (
          <div className={styles.stats}>
            <StatCard
              label="Total Listings"
              value={stats.total}
              accent="var(--color-accent)"
              sub={`${stats.addedThisMonth} added this month`}
            />
            <StatCard
              label="Available"
              value={stats.available}
              accent="var(--color-green)"
            />
            <StatCard
              label="Sold"
              value={stats.sold}
              accent="var(--color-red)"
            />
            <StatCard
              label="Rented"
              value={stats.rented}
              accent="var(--color-amber)"
            />
            <StatCard
              label="Active Sessions"
              value={stats.activeSessions}
              accent="#7C3AED"
              sub="WhatsApp collecting"
            />
            <StatCard
              label="Completed This Month"
              value={stats.completedThisMonth}
              accent="var(--color-green)"
              sub="via WhatsApp"
            />
          </div>
        ) : null}

        {/* Recent activity */}
        <div className={styles.activity}>
          <RecentActivity />
        </div>

        {/* Quick links */}
        <div className={styles.quickLinks}>
          <h2 className={styles.quickTitle}>Quick Actions</h2>
          <div className={styles.quickGrid}>
            <Link to="/properties/new" className={styles.quickCard}>
              <PlusIcon />
              <span>Add Property Manually</span>
            </Link>
            <Link to="/properties" className={styles.quickCard}>
              <ListIcon />
              <span>Browse All Properties</span>
            </Link>
            <Link to="/test/pipeline" className={styles.quickCard}>
              <PipelineIcon />
              <span>Pipeline Monitor</span>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  )
}
function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" /><line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" /><line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  )
}
function PipelineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}
