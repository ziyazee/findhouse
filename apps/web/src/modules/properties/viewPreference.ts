import { useSyncExternalStore } from 'react'

export type PropertiesView = 'table' | 'grid'

const STORAGE_KEY = 'findhouse_properties_view'
const listeners = new Set<() => void>()

function read(): PropertiesView {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'grid' ? 'grid' : 'table'
  } catch {
    return 'table'
  }
}

export function setPropertiesView(view: PropertiesView) {
  try { localStorage.setItem(STORAGE_KEY, view) } catch { /* private mode */ }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** How My properties opens on wider screens. Saved on this device. */
export function usePropertiesView() {
  return useSyncExternalStore(subscribe, read)
}
