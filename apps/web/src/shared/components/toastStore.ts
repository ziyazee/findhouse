import { create } from 'zustand'

type Tone = 'success' | 'error'

export interface ToastItem {
  id: number
  tone: Tone
  message: string
}

interface ToastStore {
  items: ToastItem[]
  push: (tone: Tone, message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastStore>((set, get) => ({
  items: [],
  push: (tone, message) => {
    const id = nextId++
    set({ items: [...get().items.slice(-2), { id, tone, message }] })
    setTimeout(() => get().dismiss(id), tone === 'error' ? 6000 : 3500)
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}))

export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
}
