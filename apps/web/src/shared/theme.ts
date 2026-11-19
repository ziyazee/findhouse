import { useSyncExternalStore } from 'react'

export const THEMES = [
  { id: 'navy', label: 'Midnight navy', swatch: '#062247' },
  { id: 'green', label: 'Forest green', swatch: '#23483d' },
  { id: 'peacock', label: 'Peacock teal', swatch: '#0d4a52' },
  { id: 'indigo', label: 'Ink indigo', swatch: '#2e2c6e' },
  { id: 'aubergine', label: 'Aubergine', swatch: '#3f1f4b' },
  { id: 'burgundy', label: 'Burgundy', swatch: '#6b1d33' },
  { id: 'cognac', label: 'Cognac', swatch: '#7d4320' },
  { id: 'espresso', label: 'Espresso', swatch: '#3d2a22' },
  { id: 'olive', label: 'Olive', swatch: '#4a5226' },
  { id: 'charcoal', label: 'Charcoal', swatch: '#22262b' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

/** Also read by the inline script in index.html, which applies the theme before first paint. */
const STORAGE_KEY = 'findhouse_theme'
const DEFAULT_THEME: ThemeId = 'navy'
const listeners = new Set<() => void>()

function isTheme(v: string | null): v is ThemeId {
  return THEMES.some((t) => t.id === v)
}

export function getTheme(): ThemeId {
  const v = document.documentElement.dataset.theme ?? null
  return isTheme(v) ? v : DEFAULT_THEME
}

export function setTheme(id: ThemeId) {
  const root = document.documentElement
  if (getTheme() === id) return
  root.classList.add('theme-switching')
  if (id === DEFAULT_THEME) delete root.dataset.theme
  else root.dataset.theme = id
  try { localStorage.setItem(STORAGE_KEY, id) } catch { /* private mode */ }
  window.setTimeout(() => root.classList.remove('theme-switching'), 400)
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useTheme() {
  return useSyncExternalStore(subscribe, getTheme)
}
