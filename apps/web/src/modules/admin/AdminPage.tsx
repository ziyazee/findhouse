import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Badge, type BadgeVariant } from '@/shared/components/Badge'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { toast } from '@/shared/components/toastStore'
import { AdminError, adminSecret, adminService, type AdminBroker } from './AdminService'
import styles from './AdminPage.module.css'

const STATUS_VARIANT: Record<string, BadgeVariant> = { ACTIVE: 'green', INACTIVE: 'grey', BLOCKED: 'red' }

export default function AdminPage() {
  const [signedIn, setSignedIn] = useState(() => Boolean(adminSecret.get()))

  useEffect(() => {
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex'
    document.head.appendChild(robots)
    return () => { robots.remove() }
  }, [])

  return (
    <main className={styles.page}>
      {signedIn ? <Numbers onSignOut={() => { adminSecret.clear(); setSignedIn(false) }} /> : <Gate onSignedIn={() => setSignedIn(true)} />}
    </main>
  )
}

function Gate({ onSignedIn }: { onSignedIn: () => void }) {
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    adminSecret.set(secret)
    try {
      await adminService.list()
      onSignedIn()
    } catch (err) {
      adminSecret.clear()
      setError(err instanceof AdminError ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.gate} onSubmit={submit}>
      <h1 className={styles.title}>FindHouse admin</h1>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <Input label="Admin secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="current-password" autoFocus />
      <Button type="submit" fullWidth loading={loading} disabled={!secret}>Continue</Button>
    </form>
  )
}

function Numbers({ onSignOut }: { onSignOut: () => void }) {
  const [brokers, setBrokers] = useState<AdminBroker[] | null>(null)
  const [phone, setPhone] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fail = useCallback((err: unknown) => {
    if (err instanceof AdminError && err.status === 401) return onSignOut()
    toast.error(err instanceof AdminError ? err.message : 'Something went wrong.')
  }, [onSignOut])

  const load = useCallback(async () => {
    try { setBrokers(await adminService.list()) } catch (err) { fail(err) }
  }, [fail])

  useEffect(() => { void load() }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError(null)
    try {
      await adminService.add(phone)
      setPhone('')
      toast.success('Number added. Tell the broker to register on the website.')
      await load()
    } catch (err) {
      if (err instanceof AdminError && err.status !== 401) setError(err.message)
      else fail(err)
    } finally {
      setAdding(false)
    }
  }

  async function act(task: () => Promise<unknown>, done: string) {
    try { await task(); toast.success(done); await load() } catch (err) { fail(err) }
  }

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Brokers</h1>
        <Button variant="ghost" size="sm" onClick={onSignOut}>Sign out</Button>
      </header>

      <form className={styles.addForm} onSubmit={add} noValidate>
        <Input label="Register a WhatsApp number" type="tel" inputMode="numeric" placeholder="9876543210" value={phone} error={error ?? undefined}
          onChange={(e) => { setPhone(e.target.value); setError(null) }} />
        <Button type="submit" loading={adding} disabled={!phone.trim()}>Add number</Button>
      </form>
      <p className={styles.note}>
        Once a number is added, tell the broker to open the site, choose Register and enter it. Numbers that aren’t here can’t register or send listings.
      </p>

      {brokers === null ? <p className={styles.note}>Loading…</p> : brokers.length === 0 ? <p className={styles.note}>No numbers yet.</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Number</th><th>Name</th><th>Public page</th><th>Registered</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {brokers.map((b) => (
                <tr key={b.id}>
                  <td>+{b.phone}</td>
                  <td>{b.name ?? '—'}</td>
                  <td>{b.registered && b.subdomain ? b.subdomain : '—'}</td>
                  <td>{b.registered ? <Badge variant="green" size="sm">Registered</Badge> : <Badge variant="amber" size="sm">Not yet</Badge>}</td>
                  <td><Badge variant={STATUS_VARIANT[b.status] ?? 'grey'} size="sm">{b.status.toLowerCase()}</Badge></td>
                  <td className={styles.actions}>
                    {b.status === 'BLOCKED'
                      ? <Button variant="secondary" size="sm" onClick={() => act(() => adminService.setStatus(b.id, 'ACTIVE'), 'Unblocked')}>Unblock</Button>
                      : <Button variant="secondary" size="sm" onClick={() => act(() => adminService.setStatus(b.id, 'BLOCKED'), 'Blocked')}>Block</Button>}
                    {!b.registered && (
                      <Button variant="danger" size="sm" onClick={() => { if (window.confirm(`Remove +${b.phone}?`)) void act(() => adminService.remove(b.id), 'Removed') }}>Remove</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
