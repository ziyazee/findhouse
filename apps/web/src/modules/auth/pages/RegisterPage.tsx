import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { useAuth } from '../useAuth'
import { AuthError } from '../auth.types'
import styles from './AuthPage.module.css'

interface FormState {
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

interface FormErrors {
  fullName?: string
  email?: string
  password?: string
  confirmPassword?: string
  form?: string
}

type StrengthLevel = 0 | 1 | 2 | 3

function getPasswordStrength(password: string): StrengthLevel {
  if (password.length === 0) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score++
  return score as StrengthLevel
}

const strengthLabels: Record<StrengthLevel, string> = {
  0: '',
  1: 'Weak — add uppercase letters and numbers',
  2: 'Fair — add numbers or special characters',
  3: 'Strong',
}

export default function RegisterPage() {
  const { register } = useAuth()
  const [fields, setFields] = useState<FormState>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)

  const strength = getPasswordStrength(fields.password)

  function set(field: keyof FormState, value: string) {
    setFields((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate(): boolean {
    const next: FormErrors = {}

    if (!fields.fullName.trim()) {
      next.fullName = 'Full name is required.'
    } else if (fields.fullName.trim().length < 2) {
      next.fullName = 'Name must be at least 2 characters.'
    }

    if (!fields.email.trim()) {
      next.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      next.email = 'Enter a valid email address.'
    }

    if (!fields.password) {
      next.password = 'Password is required.'
    } else if (fields.password.length < 8) {
      next.password = 'Password must be at least 8 characters.'
    }

    if (!fields.confirmPassword) {
      next.confirmPassword = 'Please confirm your password.'
    } else if (fields.password !== fields.confirmPassword) {
      next.confirmPassword = 'Passwords do not match.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setErrors({})

    try {
      await register({
        fullName: fields.fullName.trim(),
        email: fields.email.trim(),
        password: fields.password,
      })
      setRegistered(true)
    } catch (err) {
      const message =
        err instanceof AuthError ? err.message : 'Something went wrong. Please try again.'
      setErrors({ form: friendlyError(message) })
    } finally {
      setLoading(false)
    }
  }

  if (registered) {
    return (
      <AuthLayout>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>
            <CheckIcon />
          </div>
          <h2 className={styles.successTitle}>Check your email</h2>
          <p className={styles.successText}>
            We sent a confirmation link to <strong>{fields.email}</strong>. Open it to activate your account.
          </p>
          <Link to="/login" style={{ marginTop: 8 }}>
            <Button variant="secondary" size="md">
              Back to sign in
            </Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className={styles.formHeader}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>
          Start managing your property listings with Find House.
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {errors.form && (
          <div className={styles.formError} role="alert">
            <ErrorIcon />
            <span>{errors.form}</span>
          </div>
        )}

        <div className={styles.fields}>
          <Input
            label="Full name"
            type="text"
            placeholder="Your full name"
            value={fields.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            error={errors.fullName}
            autoComplete="name"
            autoFocus
          />

          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            value={fields.email}
            onChange={(e) => set('email', e.target.value)}
            error={errors.email}
            autoComplete="email"
          />

          <div className={styles.strengthMeter}>
            <Input
              label="Password"
              type="password"
              placeholder="Min. 8 characters"
              value={fields.password}
              onChange={(e) => set('password', e.target.value)}
              error={errors.password}
              autoComplete="new-password"
            />
            {fields.password.length > 0 && (
              <>
                <div className={styles.strengthBars}>
                  {([1, 2, 3] as const).map((level) => (
                    <div
                      key={level}
                      className={`${styles.strengthBar} ${strength >= level ? styles.active : ''}`}
                      data-level={strength >= level ? strength : undefined}
                    />
                  ))}
                </div>
                {strengthLabels[strength] && (
                  <span className={styles.strengthLabel}>{strengthLabels[strength]}</span>
                )}
              </>
            )}
          </div>

          <Input
            label="Confirm password"
            type="password"
            placeholder="Repeat your password"
            value={fields.confirmPassword}
            onChange={(e) => set('confirmPassword', e.target.value)}
            error={errors.confirmPassword}
            autoComplete="new-password"
          />
        </div>

        <Button type="submit" fullWidth size="lg" loading={loading}>
          Create account
        </Button>
      </form>

      <p className={styles.switchLink}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  )
}

function friendlyError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('user already')) {
    return 'An account with this email already exists. Sign in instead.'
  }
  if (lower.includes('weak password') || lower.includes('password should')) {
    return 'Password is too weak. Use at least 8 characters with a mix of letters and numbers.'
  }
  return msg
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
