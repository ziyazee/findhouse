import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useReducedMotion, type Variants } from 'framer-motion'
import { EntranceContext, LandingContext, easeOut, entered, rise, stagger, useEntrance, useEntranceInitial } from '../motion'

/** Lets a page animate in on its first visit after a refresh, and appear settled on every later visit. */
export function PageEntrance({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  const [first] = useState(() => !entered.has(pageKey))
  const [landing] = useState(() => entered.size === 0)
  useEffect(() => { entered.add(pageKey) }, [pageKey])
  return (
    <LandingContext.Provider value={landing}>
      <EntranceContext.Provider value={first}>{children}</EntranceContext.Provider>
    </LandingContext.Provider>
  )
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
