import { useSyncExternalStore } from 'react'

/** Whether the window is at least `px` wide, following resizes. */
export function useMinWidth(px: number) {
  const query = `(min-width: ${px}px)`
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}
