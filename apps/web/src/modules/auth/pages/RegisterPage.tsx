import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { AuthTabs } from '../components/AuthTabs'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { env } from '@/lib/env'
import { subdomainFromName, subdomainProblem } from '@/lib/siteUrls'
import { useAuth } from '../useAuth'
import { authService, NOT_INVITED } from '../AuthService'
import { AuthError, PASSWORD_MIN } from '../auth.types'
import { isIndianMobile } from '../phone'
import styles from './AuthPage.module.css'

/** What the broker's public address will look like, for the note under the name. */
const SITE_DOMAIN = env.siteDomain || 'findhouse.in'

/**
 * Two steps. First the number: FindHouse must have added it (admin page), else it isn't applicable. Then name and
 * password; the name becomes the broker's public site name.
 */
export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<'phone' | 'details'>('phone')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [loading, setLoading] = useState(false)

  const site = subdomainFromName(name)

  function fail(err: unknown) {
    setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.')
  }

  async function handlePhone(e: FormEvent) {
    e.preventDefault()
    if (!isIndianMobile(phone)) {
      setError('Enter a valid 10-digit Indian mobile number.')
      return
    }
    setLoading(true)
    setError(null)
    setAlreadyRegistered(false)
    try {
      const status = await authService.checkRegistration(phone)
      if (status === 'invited') setStep('details')
      else if (status === 'already_registered') {
        setAlreadyRegistered(true)
        setError('This number is already registered.')
      } else if (status === 'not_active') setError('This account is inactive. Contact support.')
      else setError(NOT_INVITED)
    } catch (err) {
      fail(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDetails(e: FormEvent) {
    e.preventDefault()
    const problem = !name.trim() ? 'Enter your name.' : subdomainProblem(site)
    if (problem) return setError(problem)
    if (password.length < PASSWORD_MIN) return setError(`Choose a password of at least ${PASSWORD_MIN} characters.`)
    if (password !== confirm) return setError('The two passwords don’t match.')

    setLoading(true)
    setError(null)
    try {
      await register({ phone: phone.trim(), name, password })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      fail(err)
    } finally {
      setLoading(false)
    }
  }

  const errorBox = error && (
    <div className={styles.formError} role="alert">
      <span>
        {error}
        {alreadyRegistered && <> <Link className={styles.switchLink} to="/login">Sign in</Link></>}
      </span>
    </div>
  )

  return (
    <AuthLayout>
      <AuthTabs />
      <div className={styles.formHeader}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>
          {step === 'phone' ? 'Enter the WhatsApp number FindHouse has added for you.' : 'Choose how your public page is named.'}
        </p>
      </div>

      {step === 'phone' ? (
        <form className={styles.form} onSubmit={handlePhone} noValidate>
          {errorBox}
          <div className={styles.fields}>
            <Input
              label="WhatsApp number"
              type="tel"
              name="phone"
              inputMode="numeric"
              spellCheck={false}
              placeholder="9876543210"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); if (error) setError(null) }}
              autoComplete="tel"
              autoFocus
            />
            <p className={styles.phoneHint}>+91 Indian mobile number — the same number you use on WhatsApp.</p>
          </div>
          <Button type="submit" fullWidth size="lg" loading={loading}>Continue</Button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={handleDetails} noValidate>
          <div className={styles.stepPhone}>
            <span>+91 {phone.replace(/\D/g, '').slice(-10)}</span>
            <button type="button" className={styles.linkButton} onClick={() => { setStep('phone'); setError(null) }}>Change</button>
          </div>
          {errorBox}
          <div className={styles.fields}>
            <Input
              label="Name"
              name="name"
              placeholder="Rubbing"
              value={name}
              onChange={(e) => { setName(e.target.value); if (error) setError(null) }}
              autoComplete="organization"
              autoFocus
            />
            <p className={styles.fieldNote}>
              This will display as your public URL.{' '}
              {site
                ? <>Your public page will be <span className={styles.sitePreview}>{site}.{SITE_DOMAIN}</span></>
                : <>For example, “Rubbing” gives <span className={styles.sitePreview}>rubbing.{SITE_DOMAIN}</span></>}
            </p>
            <Input
              label="Password"
              type="password"
              name="password"
              placeholder={`At least ${PASSWORD_MIN} characters`}
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(null) }}
              autoComplete="new-password"
            />
            <Input
              label="Confirm password"
              type="password"
              name="confirm"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); if (error) setError(null) }}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" fullWidth size="lg" loading={loading}>Create account</Button>
        </form>
      )}
    </AuthLayout>
  )
}
