import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useOutlet } from 'react-router-dom'
import { LayoutGroup, MotionConfig, motion } from 'framer-motion'
import {
  LayoutDashboard, Building2, CirclePlus, ChartColumn, Settings, LifeBuoy,
  Star, Menu as MenuIcon, X, LogOut, ChevronsUpDown, Plus, UserRound,
} from 'lucide-react'
import logoMark from '@/assets/logo-mark.png'
import { useAuth, useSignOut } from '@/modules/auth/useAuth'
import { initials } from '@/shared/format'
import { useProperties } from '@/modules/properties/hooks/useProperties'
import { preloadBrokerPages } from '@/app/brokerPages'
import { PHONE_QUERY, useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { easeOut, hasEntered, spring } from '../../motion'
import { PageEntrance } from '../Motion'
import { PhoneBanner } from '../PageHero/PageHero'
import { PhoneBannerContext } from '../PageHero/phoneBanner'
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
  { to: '/reviews', label: 'Reviews', icon: <Star size={18} /> },
]

const TABS: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: <LayoutDashboard size={22} /> },
  { to: '/properties', label: 'Properties', icon: <Building2 size={22} />, match: PRIMARY[1].match },
  { to: '/properties/new', label: 'Add property', icon: <Plus size={24} strokeWidth={2.25} /> },
  { to: '/performance', label: 'Performance', icon: <ChartColumn size={22} /> },
  { to: '/profile', label: 'Profile', icon: <UserRound size={22} />, match: (p) => ['/profile', '/settings', '/help', '/enquiries', '/reviews'].includes(p) },
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
  const { user } = useAuth()
  const handleLogout = useSignOut()
  const { data: properties } = useProperties()
  const { pathname } = useLocation()
  const outlet = useOutlet()
  const isPhone = useMediaQuery(PHONE_QUERY)
  const [bannerHeight, setBannerHeight] = useState<number | null>(null)
  const contentRef = useRef<HTMLElement>(null)

  // Slide the new page in from the side it sits on in the menu
  const [page, setPage] = useState({ path: pathname, dir: 1, revisit: false })
  if (page.path !== pathname) {
    setPage({ path: pathname, dir: navIndex(pathname) >= navIndex(page.path) ? 1 : -1, revisit: hasEntered(pathname) })
  }

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
  const avatar = initials(name)

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
                  <span className={styles.avatar} aria-hidden="true">{avatar}</span>
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
            {isPhone && <PhoneBanner height={bannerHeight} className={styles.shellBanner} />}
            {/* Outside the keyed page so a page still downloading keeps the previous one on screen instead of a spinner. */}
            <Suspense fallback={<div className={`${styles.container} ${styles.page}`}><div className={styles.pageLoading}><div className="spinner" /></div></div>}>
              <PhoneBannerContext.Provider value={isPhone ? setBannerHeight : null}>
                <motion.div
                  key={pathname}
                  className={`${styles.container} ${styles.page} ${isPhone && page.revisit ? styles.settle : ''}`}
                  // Phones switch tabs instantly: fading the full-bleed page in shows a blank screen first.
                  initial={isPhone ? false : { opacity: 0, x: 28 * page.dir }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, ease: easeOut }}
                >
                  <PageEntrance pageKey={pathname}>{outlet}</PageEntrance>
                </motion.div>
              </PhoneBannerContext.Provider>
            </Suspense>
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
