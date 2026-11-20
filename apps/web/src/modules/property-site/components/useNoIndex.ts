import { useEffect } from 'react'

/** Asks search engines not to index this page while `active`. */
export function useNoIndex(active: boolean) {
  useEffect(() => {
    if (!active) return
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [active])
}
