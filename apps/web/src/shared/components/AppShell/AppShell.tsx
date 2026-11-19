import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { LayoutGroup, MotionConfig, motion } from 'framer-motion'
import {
  LayoutDashboard, Building2, CirclePlus, ChartColumn, Settings, LifeBuoy,
  Menu as MenuIcon, X, LogOut, ChevronsUpDown, Plus, UserRound,
} from 'lucide-react'
import logoMark from '@/assets/logo-mark.png'
import { useAuth } from '@/modules/auth/useAuth'
import { useProperties } from '@/modules/properties/hooks/useProperties'
import { preloadBrokerPages } from '@/brokerPages'
import { easeOut, spring } from '../../motion'
import { PageEntrance } from '../Motion'
import { Menu } from '../Menu'
import styles from './AppShell.module.css'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  match?: (path: string) => boolean
}

const PRIMARY: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  {
    to: '/properties',
    label: 'My properties',
    icon: <Building2 size={18} />,
    match: (p) => p.startsWith('/properties') && p !== '/properties/new',
  },
  { to: '/properties/new', label: 'Add property', icon: <CirclePlus size={18} /> },
  { to: '/profile', label: 'Profile', icon: <UserRound size={18} /> },
  { to: '/performance', label: 'Performance', icon: <ChartColumn size={18} /> },
]

const TABS: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: <LayoutDashboard size={22} /> },
  { to: '/properties', label: 'Properties', icon: <Building2 size={22} />, match: PRIMARY[1].match },
  { to: '/properties/new', label: 'Add property', icon: <Plus size={24} strokeWidth={2.25} /> },
  { to: '/performance', label: 'Performance', icon: <ChartColumn size={22} /> },
  { to: '/profile', label: 'Profile', icon: <UserRound size={22} />, match: (p) => ['/profile', '/settings', '/help', '/enquiries'].includes(p) },
]

// Full-screen tasks: they have their own back link and a sticky save bar.
const isTaskPage = (p: string) => /^\/properties\/[^/]+$/.test(p)

const SECONDARY: NavItem[] = [
  { to: '/settings', label: 'Account settings', icon: <Settings size={18} /> },
  { to: '/help', label: 'Help & support', icon: <LifeBuoy size={18} /> },
]

const NAV_ORDER = [...PRIMARY, ...SECONDARY]
const navIndex = (p: string) => {
  const i = NAV_ORDER.findIndex((n) => (n.match ? n.match(p) : p === n.to))
  return i === -1 ? NAV_ORDER.length : i
}

/** Persistent workspace layout: sidebar, phone tab bar and the current page. */
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { user, logout } = useAuth()
  const { data: properties } = useProperties()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const outlet = useOutlet()
  const contentRef = useRef<HTMLElement>(null)

  // Slide the new page in from the side it sits on in the menu
  const [page, setPage] = useState({ path: pathname, dir: 1 })
  if (page.path !== pathname) setPage({ path: pathname, dir: navIndex(pathname) >= navIndex(page.path) ? 1 : -1 })

  useEffect(() => setDrawerOpen(false), [pathname])

  useLayoutEffect(() => {
    if (window.location.hash) return
    window.scrollTo(0, 0)
    contentRef.current?.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300))
    idle(() => preloadBrokerPages())
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const showTabs = !isTaskPage(pathname)
  const name = user?.name ?? 'Broker'
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  function renderLink(item: NavItem) {
    const active = item.match ? item.match(pathname) : pathname === item.to
    const count = item.to === '/properties' ? properties?.length : undefined
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        {active && <motion.span layoutId="nav-active" className={styles.navPill} transition={spring} aria-hidden="true" />}
        <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
        <span className={styles.navLabel}>{item.label}</span>
        {count ? <span className={styles.navCount}>{count}</span> : null}
      </NavLink>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={`${styles.shell} ${showTabs ? styles.withTabs : ''}`} data-bottom-nav={showTabs || undefined}>
        <div
          className={`${styles.overlay} ${drawerOpen ? styles.overlayOpen : ''}`}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />

        <aside className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ''}`} aria-label="Sidebar">
          <div className={styles.brandRow}>
            <Link to="/dashboard" className={styles.brand}>
              <span className={styles.brandMark} aria-hidden="true"><img src={logoMark} alt="" /></span>
              <span className={styles.brandName}>FindHouse</span>
            </Link>
            <button className={styles.closeBtn} onClick={() => setDrawerOpen(false)} aria-label="Close menu">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <nav className={styles.nav} aria-label="Main">
            <LayoutGroup id="sidebar">
              <div className={styles.navGroup}>{PRIMARY.map(renderLink)}</div>
              <div className={`${styles.navGroup} ${styles.navGroupBottom}`}>{SECONDARY.map(renderLink)}</div>
            </LayoutGroup>
          </nav>

          <div className={styles.account}>
            <Menu
              label="Account"
              placement="above"
              align="start"
              triggerClassName={styles.accountBtn}
              trigger={
                <>
                  <span className={styles.avatar} aria-hidden="true">{initials}</span>
                  <span className={styles.accountText}>
                    <span className={styles.accountName}>{name}</span>
                    <span className={styles.accountPhone}>+{user?.phone}</span>
                  </span>
                  <ChevronsUpDown size={16} className={styles.accountChevron} aria-hidden="true" />
                </>
              }
              items={[
                { label: 'Profile', icon: <UserRound size={16} />, to: '/profile' },
                { label: 'Account settings', icon: <Settings size={16} />, to: '/settings' },
                { label: 'Help & support', icon: <LifeBuoy size={16} />, to: '/help' },
                { label: 'Sign out', icon: <LogOut size={16} />, onSelect: handleLogout, separatorBefore: true },
              ]}
            />
          </div>
        </aside>

        <div className={styles.main}>
          <header className={styles.topBar}>
            <button className={styles.menuBtn} onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <MenuIcon size={20} aria-hidden="true" />
            </button>
            <Link to="/dashboard" className={styles.brand}>
              <span className={styles.brandMark} aria-hidden="true"><img src={logoMark} alt="" /></span>
              <span className={styles.brandName}>FindHouse</span>
            </Link>
          </header>

          <main className={styles.content} ref={contentRef}>
            <motion.div
              key={pathname}
              className={styles.container}
              initial={{ opacity: 0, x: 28 * page.dir }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: easeOut }}
            >
              <PageEntrance pageKey={pathname}>
                <Suspense fallback={<div className={styles.pageLoading}><div className="spinner" /></div>}>
                  {outlet}
                </Suspense>
              </PageEntrance>
            </motion.div>
          </main>
        </div>

        {showTabs && (
          <nav className={styles.tabBar} aria-label="Quick navigation">
            <LayoutGroup id="tabs">
              {TABS.map((t) => {
                const active = t.match ? t.match(pathname) : pathname === t.to
                const isAdd = t.to === '/properties/new'
                return (
                  <Link
                    key={t.to}
                    to={t.to}
                    className={`${styles.tab} ${active ? styles.tabActive : ''} ${isAdd ? styles.tabAdd : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {active && !isAdd && !drawerOpen && <motion.span layoutId="tab-active" className={styles.tabPill} transition={spring} aria-hidden="true" />}
                    <span className={styles.tabIcon} aria-hidden="true">{t.icon}</span>
                    <span className={isAdd ? 'sr-only' : styles.tabLabel}>{t.label}</span>
                  </Link>
                )
              })}
            </LayoutGroup>
          </nav>
        )}
      </div>
    </MotionConfig>
  )
}
