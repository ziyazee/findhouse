import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { AuthTabs } from '../components/AuthTabs'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { useAuth } from '../useAuth'
import { AuthError } from '../auth.types'
import { isIndianMobile } from '../phone'
import styles from './AuthPage.module.css'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function validate(): boolean {
    if (!phone.replace(/\D/g, '')) {
      setError('Phone number is required.')
      return false
    }
    if (!isIndianMobile(phone)) {
      setError('Enter a valid 10-digit Indian mobile number.')
      return false
    }
    if (!password) {
      setError('Password is required.')
      return false
    }
    setError(null)
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setError(null)

    try {
      await login({ phone: phone.trim(), password })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(
        err instanceof AuthError
          ? err.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <AuthTabs />
      <div className={styles.formHeader}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in with your WhatsApp number and password.</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {error && (
          <div className={styles.formError} role="alert">
            <ErrorIcon />
            <span>{error}</span>
          </div>
        )}

        <div className={styles.fields}>
          <Input
            label="Phone number"
            type="tel"
            name="phone"
            inputMode="numeric"
            spellCheck={false}
            placeholder="9876543210"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              if (error) setError(null)
            }}
            error={undefined}
            autoComplete="tel"
            autoFocus
          />
          <p className={styles.phoneHint}>
            +91 Indian mobile number — the same number you use on WhatsApp.
          </p>
          <Input
            label="Password"
            type="password"
            name="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (error) setError(null)
            }}
            autoComplete="current-password"
          />
        </div>

        <Button type="submit" fullWidth size="lg" loading={loading}>
          Sign in
        </Button>
      </form>

      <div className={styles.adminNote}>
        <WhatsAppIcon />
        <span>
          New here? Ask FindHouse to add your WhatsApp number, then use the Register tab.
        </span>
      </div>
    </AuthLayout>
  )
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={styles.inlineIcon}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={styles.inlineIcon}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}
