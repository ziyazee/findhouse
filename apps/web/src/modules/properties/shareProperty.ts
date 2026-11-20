import { currentSite, listingSiteUrl } from '@/lib/site'
import { toast } from '@/shared/components/toastStore'
import type { Property } from './property.types'

/** The listing's page on this site. In the workspace, pass `useMySite().listingUrl(p)` for the broker's own site. */
export const publicUrl = (p: Pick<Property, 'slug'>) => listingSiteUrl(currentSite(), p.slug, null)

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Public link copied')
  } catch {
    toast.error('Couldn’t copy the link')
  }
}

export const copyPropertyLink = (p: Pick<Property, 'slug'>, url = publicUrl(p)) => copyLink(url)

/** System share sheet where available, otherwise copies the link. */
export async function shareLink(title: string, url: string) {
  if (navigator.share) {
    try { await navigator.share({ title, url }) } catch { /* dismissed */ }
    return
  }
  await copyLink(url)
}

export const shareProperty = (p: Pick<Property, 'slug' | 'title'>, url = publicUrl(p)) => shareLink(p.title, url)
