import { useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

const PARAM = 'tour'

/**
 * Keeps the full-screen gallery open in `?tour=1`, so the browser's Back button closes it and a shared link opens on it.
 * The lightbox's `?photo=N` sits on top of it, so Back from a photo returns to the tour.
 */
export function useTourParam() {
  const [params, setParams] = useSearchParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const open = params.get(PARAM) === '1'
  const openedHere = (state as { tour?: boolean } | null)?.tour === true

  const write = useCallback((on: boolean, replace: boolean, nextState: unknown) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (on) next.set(PARAM, '1')
      else next.delete(PARAM)
      return next
    }, { replace, state: nextState, preventScrollReset: true })
  }, [setParams])

  const show = useCallback(() => write(true, false, { tour: true }), [write])

  const close = useCallback(() => {
    if (openedHere) navigate(-1)
    else write(false, true, state)
  }, [openedHere, navigate, write, state])

  return { open, show, close }
}
