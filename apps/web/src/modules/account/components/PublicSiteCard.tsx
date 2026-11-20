import { useState, type FormEvent } from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import { env } from '@/lib/env'
import { normalizeSubdomain, subdomainProblem } from '@/lib/site'
import { Button } from '@/shared/components/Button'
import { Card, CardHeader } from '@/shared/components/Card'
import { toast } from '@/shared/components/toastStore'
import { SubdomainError } from '@/modules/broker-site/BrokerService'
import { useMySite, useSetSubdomain } from '@/modules/broker-site/useBrokerSite'
import styles from './PublicSiteCard.module.css'

/** Shown after the field when subdomains aren't switched on in this build yet. */
const DEFAULT_DOMAIN = 'findhouse.in'

/** The broker's public site name (their subdomain), with a field to change it. */
export function PublicSiteCard() {
  const site = useMySite()
  const save = useSetSubdomain()
  const saved = site.subdomain ?? ''
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? saved
  const changed = value !== saved
  const problem = changed && value ? subdomainProblem(value) : null
  const [serverError, setServerError] = useState<string | null>(null)
  const error = problem ?? serverError

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!changed || problem || !value) return
    try {
      await save.mutateAsync(value)
      setDraft(null)
      toast.success('Site name saved')
    } catch (err) {
      if (err instanceof SubdomainError) setServerError(err.message)
      else toast.error(err instanceof Error ? err.message : 'Couldn’t save the site name')
    }
  }

  async function copy() {
    if (!site.pageUrl) return
    try {
      await navigator.clipboard.writeText(site.pageUrl)
      toast.success('Link copied')
    } catch {
      toast.error('Couldn’t copy the link')
    }
  }

  return (
    <Card>
      <CardHeader
        title="Public site"
        description="Your public listings live at this address. We made it from your name; you can change it."
      />
      <form className={styles.body} onSubmit={onSubmit} noValidate>
        <label className={styles.label} htmlFor="site-name">Site name</label>
        <div className={`${styles.field} ${error ? styles.fieldError : ''}`}>
          <input
            id="site-name"
            className={styles.input}
            value={value}
            placeholder={site.profile.isLoading ? '' : 'your-name'}
            onChange={(e) => {
              setServerError(null)
              setDraft(normalizeSubdomain(e.target.value))
            }}
            disabled={site.profile.isLoading}
            maxLength={40}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby="site-name-help"
          />
          <span className={styles.suffix}>.{env.siteDomain || DEFAULT_DOMAIN}</span>
        </div>
        <p id="site-name-help" className={error ? styles.error : styles.help} role={error ? 'alert' : undefined}>
          {error ?? (changed
            ? 'Links to your old site name will stop working. Links to your listings keep working.'
            : !saved && !site.profile.isLoading
              ? 'Choose a name to get your own address.'
              : 'Lowercase letters, numbers and hyphens.')}
        </p>
        <div className={styles.actions}>
          {changed && (
            <>
              <Button type="submit" loading={save.isPending} disabled={Boolean(problem) || !value}>Save</Button>
              <Button type="button" variant="ghost" onClick={() => { setDraft(null); setServerError(null) }}>Cancel</Button>
            </>
          )}
          {!changed && site.pageUrl && (
            <>
              <Button as="a" href={site.pageUrl} target="_blank" rel="noreferrer" variant="secondary">
                <ExternalLink size={16} aria-hidden="true" />Open
              </Button>
              <Button type="button" variant="secondary" onClick={copy}>
                <Copy size={16} aria-hidden="true" />Copy link
              </Button>
            </>
          )}
        </div>
      </form>
    </Card>
  )
}
