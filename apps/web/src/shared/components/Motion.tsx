import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useReducedMotion, type Variants } from 'framer-motion'
import { EntranceContext, easeOut, rise, stagger, useEntrance, useEntranceInitial } from '../motion'

/** Pages that already played their entrance; cleared only by a full page load. */
const entered = new Set<string>()

/** Lets a page animate in on its first visit after a refresh, and appear settled on every later visit. */
export function PageEntrance({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  const [first] = useState(() => !entered.has(pageKey))
  useEffect(() => { entered.add(pageKey) }, [pageKey])
  return <EntranceContext.Provider value={first}>{children}</EntranceContext.Provider>
}

interface RevealProps {
  children: ReactNode
  className?: string
  /** Seconds between children. */
  gap?: number
  delay?: number
}

/** Starts a staggered entrance; motion children (`Item`, or any with `rise`/`pop` variants) follow it. */
export function Reveal({ children, className, gap = 0.08, delay = 0 }: RevealProps) {
  const initial = useEntranceInitial()
  return (
    <motion.div className={className} variants={stagger(gap, delay)} initial={initial} animate="show">
      {children}
    </motion.div>
  )
}

export function Item({ children, className, variants = rise }: { children: ReactNode; className?: string; variants?: Variants }) {
  return <motion.div className={className} variants={variants}>{children}</motion.div>
}

/** Counts up to `value` when it first appears or changes. */
export function CountUp({ value, duration = 0.9 }: { value: number; duration?: number }) {
  const reduce = useReducedMotion()
  const entrance = useEntrance()
  const [shown, setShown] = useState(reduce || !entrance ? value : 0)
  const current = useRef(shown)

  useEffect(() => {
    if (reduce || current.current === value) { current.current = value; setShown(value); return }
    const controls = animate(current.current, value, {
      duration,
      ease: easeOut,
      onUpdate: (v) => { current.current = v; setShown(Math.round(v)) },
    })
    return () => controls.stop()
  }, [value, duration, reduce])

  return <>{shown}</>
}
