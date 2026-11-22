import { NavLink } from 'react-router-dom'
import styles from '../pages/AuthPage.module.css'

/** Sign in / Register switch at the top of both auth pages. */
export function AuthTabs() {
  const tab = ({ isActive }: { isActive: boolean }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`
  return (
    <nav className={styles.tabs} aria-label="Account">
      <NavLink to="/login" className={tab} replace>Sign in</NavLink>
      <NavLink to="/register" className={tab} replace>Register</NavLink>
    </nav>
  )
}
