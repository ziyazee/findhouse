import { currentSite, listingSiteUrl } from '@/lib/site'
import { toast } from '@/shared/components/toastStore'
import type { Property } from './property.types'

/** The listing's page on this site. In the workspace, pass `useMySite().listingUrl(p)` for the broker's own site. */
export const publicUrl = (p: Pick<Property, 'shortId' | 'title'>) => listingSiteUrl(currentSite(), p, null)

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Public link copied')
  } catch {
    toast.error('Couldn’t copy the link')
  }
}

export const copyPropertyLink = (p: Pick<Property, 'shortId' | 'title'>, url = publicUrl(p)) => copyLink(url)

/** System share sheet where available, otherwise copies the link. */
export async function shareLink(title: string, url: string) {
  if (navigator.share) {
    try { await navigator.share({ title, url }) } catch { /* dismissed */ }
    return
  }
  await copyLink(url)
}

/** Opens WhatsApp with the link pre-filled so the broker picks who to send it to. */
export function shareOnWhatsApp(url: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank', 'noopener')
}

export function shareProperty(p: Pick<Property, 'id' | 'shortId' | 'title'>, url = publicUrl(p)) {
  return shareLink(p.title, url)
}
