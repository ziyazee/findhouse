import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Link2, Send } from 'lucide-react'
import logoMark from '@/assets/logo-mark.png'
import styles from './AuthLayout.module.css'

interface AuthLayoutProps {
  children: ReactNode
}

const STEPS = [
  { icon: <Camera size={18} />, title: 'Send photos and details', text: 'From your phone, to one WhatsApp number.' },
  { icon: <Send size={18} />, title: 'Reply “done”', text: 'FindHouse reads the details and sorts the photos.' },
  { icon: <Link2 size={18} />, title: 'Share the listing', text: 'Every property gets its own page to send to tenants.' },
]

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={styles.root}>
      <aside className={styles.brand}>
        <div className={styles.brandInner}>
          <div className={styles.logo}>
            <span className={styles.logoMark} aria-hidden="true"><img src={logoMark} alt="" /></span>
            <span className={styles.logoName}>FindHouse</span>
          </div>

          <div className={styles.brandBody}>
            <h2 className={styles.brandHeadline}>Every rental, listed straight from WhatsApp.</h2>
            <p className={styles.brandSub}>
              Manage your properties, track what’s rented and share listings, all in one place.
            </p>

            <ol className={styles.steps}>
              {STEPS.map((s) => (
                <li key={s.title} className={styles.step}>
                  <span className={styles.stepIcon} aria-hidden="true">{s.icon}</span>
                  <span>
                    <span className={styles.stepTitle}>{s.title}</span>
                    <span className={styles.stepText}>{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <p className={styles.footnote}>© FindHouse · <Link to="/privacy">Privacy</Link></p>
        </div>
      </aside>

      <main className={styles.formPanel}>
        <div className={styles.formInner}>
          <div className={styles.mobileLogo}>
            <span className={styles.logoMark} aria-hidden="true"><img src={logoMark} alt="" /></span>
            <span className={styles.logoName}>FindHouse</span>
          </div>

          {children}
          <p className={styles.legal}><Link to="/privacy">Privacy policy</Link></p>
        </div>
      </main>
    </div>
  )
}
