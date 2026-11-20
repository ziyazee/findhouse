import { useEffect } from 'react'
import { currentSite, mainOrigin } from '@/lib/site'
import { PageSpinner } from '@/shared/components/PageSpinner'

/** Anything else on a broker's subdomain (login, the workspace) lives on the main site. */
export function ToMainSite() {
  useEffect(() => {
    const { pathname, search, hash } = window.location
    window.location.replace(`${mainOrigin(currentSite())}${pathname}${search}${hash}`)
  }, [])
  return <PageSpinner />
}
