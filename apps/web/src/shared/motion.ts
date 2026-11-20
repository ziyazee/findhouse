import { createContext, useContext } from 'react'
import type { Transition, Variants } from 'framer-motion'

export const easeOut = [0.22, 1, 0.36, 1] as const

/** Pages that already played their entrance; cleared only by a full page load. */
export const entered = new Set<string>()

/** Whether this page has already played its entrance since the app was loaded. */
export function hasEntered(pageKey: string) {
  return entered.has(pageKey)
}

/** Whether the current page should play its entrance animations (first visit since the page loaded). */
export const EntranceContext = createContext(true)

export function useEntrance() {
  return useContext(EntranceContext)
}

/** Whether the current page is the one the app was opened on, rather than one reached by navigating. */
export const LandingContext = createContext(true)

export function useIsLandingPage() {
  return useContext(LandingContext)
}

/** `initial` prop for entrance animations: start hidden on a first visit, otherwise render settled. */
export function useEntranceInitial() {
  return useEntrance() ? 'hidden' : false
}

export const spring: Transition = { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 }

/** Parent that reveals its motion children one after another. */
export function stagger(gap = 0.07, delay = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: gap, delayChildren: delay } },
  }
}

/** Fades in while moving up a little. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOut } },
}

/** `rise` that starts after `delay` seconds (a variant's own transition wins over the `transition` prop). */
export function riseAfter(delay: number): Variants {
  return {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOut, delay } },
  }
}

/** Card entrance with a soft spring. */
export const pop: Variants = {
  hidden: { opacity: 0, y: 26, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 24 } },
}

/** List item that waits its turn by index (`custom`), so items mounted late still cascade. */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOut, delay: Math.min(i, 12) * 0.06 },
  }),
}
