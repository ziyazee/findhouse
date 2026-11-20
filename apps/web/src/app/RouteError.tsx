import { useRouteError } from 'react-router-dom'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { Card, EmptyState } from '@/shared/components/Card'
import styles from './RouteError.module.css'

/** After a deploy, old tabs ask for page files that no longer exist; a reload picks up the new ones. */
function isStaleBuild(error: unknown) {
  return error instanceof Error && /dynamically imported module|importing a module script|failed to fetch/i.test(error.message)
}

/** Shown instead of a page that crashed. `inShell` keeps the workspace navigation around it. */
export function RouteError({ inShell = false }: { inShell?: boolean }) {
  const error = useRouteError()
  const stale = isStaleBuild(error)
  if (import.meta.env.DEV) console.error(error)

  return (
    <div className={inShell ? styles.inShell : styles.page}>
      <Card className={styles.card}>
        <EmptyState
          icon={<TriangleAlert size={20} />}
          title={stale ? 'FindHouse has been updated' : 'Something went wrong'}
          description={stale ? 'Reload to get the latest version.' : 'This page hit an unexpected problem. Reloading usually fixes it.'}
          action={
            <Button variant="secondary" onClick={() => window.location.reload()}>
              <RefreshCw size={16} aria-hidden="true" />
              Reload
            </Button>
          }
        />
      </Card>
    </div>
  )
}
