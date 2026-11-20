import { useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

const PARAM = 'photo'

/**
 * Keeps the open lightbox photo in `?photo=N` (1-based), so a link opens straight onto that photo
 * and the browser's Back button closes the lightbox instead of leaving the listing.
 */
export function usePhotoParam(count: number) {
  const [params, setParams] = useSearchParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const openedHere = (state as { photos?: boolean } | null)?.photos === true

  const n = Number(params.get(PARAM))
  const open = Number.isInteger(n) && n >= 1 && n <= count ? n - 1 : null

  const write = useCallback((index: number | null, replace: boolean, nextState: unknown) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (index == null) next.delete(PARAM)
      else next.set(PARAM, String(index + 1))
      return next
    }, { replace, state: nextState, preventScrollReset: true })
  }, [setParams])

  /** Opens the lightbox as a new history entry, so Back returns to the listing. */
  const show = useCallback((index: number) => write(index, false, { photos: true }), [write])

  /** Follows the lightbox as the guest moves between photos, without adding history entries. */
  const follow = useCallback((index: number) => write(index, true, state), [write, state])

  /** Steps back to the entry we pushed; a shared link that opened on a photo just drops the parameter. */
  const close = useCallback(() => {
    if (openedHere) navigate(-1)
    else write(null, true, state)
  }, [openedHere, navigate, write, state])

  return { open, show, follow, close }
}
