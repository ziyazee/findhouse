import { useEffect, useState } from 'react'

/** True once the page has scrolled past `offset`, or straight away when the page is too short to scroll that far. */
export function useScrolledPast(offset: number) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const update = () => {
      const room = document.documentElement.scrollHeight - window.innerHeight
      setPast(room < offset * 2 || window.scrollY > offset)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [offset])
  return past
}
