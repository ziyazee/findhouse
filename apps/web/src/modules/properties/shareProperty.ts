import { toast } from '@/shared/components/toastStore'
import type { Property } from './property.types'

export const publicUrl = (p: Pick<Property, 'slug'>) => `${window.location.origin}/p/${p.slug}`

export async function copyPropertyLink(p: Pick<Property, 'slug'>) {
  try {
    await navigator.clipboard.writeText(publicUrl(p))
    toast.success('Public link copied')
  } catch {
    toast.error('Couldn’t copy the link')
  }
}

/** System share sheet where available, otherwise copies the public link. */
export async function shareProperty(p: Pick<Property, 'slug' | 'title'>) {
  if (navigator.share) {
    try { await navigator.share({ title: p.title, url: publicUrl(p) }) } catch { /* dismissed */ }
    return
  }
  await copyPropertyLink(p)
}
