import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AuthLayout } from './AuthLayout'
import { AuthTabs } from './AuthTabs'
import styles from '../pages/AuthPage.module.css'

/** The padding around the form in `.paneInner` (6px a side). Nothing but padding means the page is still loading. */
const EMPTY_HEIGHT = 12

/** The height of whatever is inside, kept up to date, so the box around it can glide between sizes. */
function useContentHeight() {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>()
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // An empty box (a page that is still loading) is not a size to animate to: keep the last real height.
    const measure = () => { if (el.offsetHeight > EMPTY_HEIGHT) setHeight(el.offsetHeight) }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, height] as const
}

/**
 * Sign in and Register share this: the page, the tabs and the box under them stay mounted while only the form inside
 * changes. That is what lets the tab pill slide, the box change height smoothly and the form cross-fade.
 */
export function AuthShell() {
  const { pathname } = useLocation()
  // Captured at render time, so the form that is leaving keeps showing its own route, not the one arriving.
  const outlet = useOutlet()
  const reduce = useReducedMotion()
  const [content, height] = useContentHeight()

  // Which way the form leaves and arrives: Register is to the right of Sign in.
  const side = pathname.startsWith('/register') ? 1 : -1
  const move = reduce ? 0 : 14

  return (
    <AuthLayout>
      <AuthTabs />
      <motion.div
        className={styles.paneBox}
        initial={false}
        animate={height === undefined ? undefined : { height }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
      >
        <div ref={content} className={styles.paneInner}>
          <AnimatePresence mode="wait" initial={false} custom={side}>
            <motion.div
              key={pathname.startsWith('/register') ? 'register' : 'login'}
              custom={side}
              variants={{
                enter: (s: number) => ({ opacity: 0, x: s * move }),
                shown: { opacity: 1, x: 0 },
                leave: (s: number) => ({ opacity: 0, x: s * -move }),
              }}
              initial="enter"
              animate="shown"
              exit="leave"
              transition={{ duration: reduce ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <Suspense fallback={null}>{outlet}</Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </AuthLayout>
  )
}
