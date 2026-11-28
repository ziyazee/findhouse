import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import styles from '../pages/AuthPage.module.css'

/** Both pages are separate lazy chunks: load them now so switching doesn't wait for the network. */
function preloadPages() {
  void import('../pages/LoginPage')
  void import('../pages/RegisterPage')
}

/** Sign in / Register switch at the top of both auth pages. It stays mounted, so the pill really slides. */
export function AuthTabs() {
  const { pathname } = useLocation()
  const index = pathname.startsWith('/register') ? 1 : 0

  useEffect(preloadPages, [])

  const tab = ({ isActive }: { isActive: boolean }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`
  return (
    <nav className={styles.tabs} aria-label="Account">
      <span className={styles.tabPill} style={{ transform: `translateX(calc(${index} * (100% + 4px)))` }} aria-hidden="true" />
      <NavLink to="/login" className={tab} replace>Sign in</NavLink>
      <NavLink to="/register" className={tab} replace>Register</NavLink>
    </nav>
  )
}
