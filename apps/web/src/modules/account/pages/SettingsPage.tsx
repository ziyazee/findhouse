import type { CSSProperties } from 'react'
import { Check, LayoutGrid, List, LogOut } from 'lucide-react'
import { Badge } from '@/shared/components/Badge'
import { Button } from '@/shared/components/Button'
import { Card, CardHeader, } from '@/shared/components/Card'
import { Item, Reveal } from '@/shared/components/Motion'
import { PageHero } from '@/shared/components/PageHero/PageHero'
import { heroBody } from '@/shared/components/PageHero/heroClasses'
import { toast } from '@/shared/components/toastStore'
import { useAuth, useSignOut } from '@/modules/auth/useAuth'
import { setPropertiesView, usePropertiesView, type PropertiesView } from '@/modules/properties/viewPreference'
import { THEMES, setTheme, useTheme } from '@/shared/theme'
import { PublicSiteCard } from '../components/PublicSiteCard'
import styles from './SettingsPage.module.css'

export default function SettingsPage() {
  const { user } = useAuth()
  const handleLogout = useSignOut()
  const view = usePropertiesView()
  const theme = useTheme()

  function chooseView(v: PropertiesView) {
    setPropertiesView(v)
    toast.success(`Properties will open in ${v === 'table' ? 'list' : 'grid'} view`)
  }

  return (
    <>
      <PageHero title="Account settings" subtitle="Your profile and workspace preferences." />

      <Reveal className={`${styles.stack} ${heroBody}`} gap={0.09} delay={0.2}>
        <Item>
          <Card>
            <CardHeader title="Profile" description="Your name and number come from your FindHouse registration." />
            <dl className={styles.list}>
              <div className={styles.row}>
                <dt>Name</dt>
                <dd>{user?.name ?? 'Not set'}</dd>
              </div>
              <div className={styles.row}>
                <dt>WhatsApp number</dt>
                <dd className={styles.num}>+{user?.phone}</dd>
              </div>
              <div className={styles.row}>
                <dt>Account status</dt>
                <dd><Badge variant="green" dot>Active</Badge></dd>
              </div>
            </dl>
          </Card>
        </Item>

        <Item>
          <PublicSiteCard />
        </Item>

        <Item>
          <Card>
            <CardHeader title="Preferences" description="Saved on this device." />
            <div className={styles.row}>
              <div>
                <p className={styles.prefTitle}>Colour theme</p>
                <p className={styles.prefText}>{THEMES.find((t) => t.id === theme)?.label} · applies instantly.</p>
              </div>
              <div className={styles.swatches} role="group" aria-label="Colour theme">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={theme === t.id}
                    aria-label={`${t.label} theme`}
                    title={t.label}
                    className={styles.swatch}
                    style={{ '--swatch': t.swatch } as CSSProperties}
                    onClick={() => setTheme(t.id)}
                  >
                    {theme === t.id && <Check size={16} strokeWidth={3} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.row}>
              <div>
                <p className={styles.prefTitle}>Default properties view</p>
                <p className={styles.prefText}>How My properties opens.</p>
              </div>
              <div className={styles.segment} role="group" aria-label="Default properties view">
                <button type="button" aria-pressed={view === 'table'} onClick={() => chooseView('table')}>
                  <List size={16} aria-hidden="true" />List
                </button>
                <button type="button" aria-pressed={view === 'grid'} onClick={() => chooseView('grid')}>
                  <LayoutGrid size={16} aria-hidden="true" />Grid
                </button>
              </div>
            </div>
          </Card>
        </Item>

        <Item>
          <Card>
            <CardHeader title="Session" />
            <div className={styles.row}>
              <div>
                <p className={styles.prefTitle}>Sign out</p>
                <p className={styles.prefText}>You’ll need your WhatsApp number to sign in again.</p>
              </div>
              <Button variant="secondary" onClick={handleLogout}>
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </Button>
            </div>
          </Card>
        </Item>
      </Reveal>
    </>
  )
}
