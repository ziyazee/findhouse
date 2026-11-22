import { inr, rupeesInWords } from '../../src/shared/format'

// Listing pages are drawn in the browser, so link previews (WhatsApp, iMessage, Facebook…) only see the bare
// index.html. This puts the listing's title, price and cover photo into that HTML as Open Graph tags.
// Reads the same Pages environment variables as the app build.

interface Env {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
  VITE_SUPABASE_ANON_KEY?: string
  VITE_R2_PUBLIC_URL?: string
}

export interface PreviewListing {
  title: string | null
  listing_type: string | null
  price: number | null
  preview_image_path?: string | null
  property_media: Array<{ storage_path: string | null; media_type: string; is_cover: boolean | null; display_order: number | null }> | null
}

export interface Preview {
  title: string
  description: string
  image: string | null
  /** The image is a made card, whose size is known. */
  card?: boolean
  url?: string
}

/**
 * The listing name as the title and only the price ("₹47,000 a month") under it. The image is the card the
 * preview-card edge function made (cover photo with name and price on it), else the cover photo.
 */
export function listingPreview(listing: PreviewListing, mediaBaseUrl: string): Preview {
  const rent = listing.listing_type === 'rent'
  const description = listing.price ? (rent ? `${inr(listing.price)} a month` : rupeesInWords(listing.price)) : ''

  const photos = (listing.property_media ?? [])
    .filter((m) => m.media_type !== 'video' && m.storage_path)
    .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || (a.display_order ?? 0) - (b.display_order ?? 0))
  const path = listing.preview_image_path || photos[0]?.storage_path
  const image = path && mediaBaseUrl ? `${mediaBaseUrl.replace(/\/+$/, '')}/${path}` : null

  return { title: listing.title || 'Property on FindHouse', description, image, card: Boolean(listing.preview_image_path) }
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function previewTags(p: Preview): string {
  const tags = [
    ['og:type', 'website'],
    ['og:site_name', 'FindHouse'],
    ['og:title', p.title],
    ...(p.description ? [['og:description', p.description]] : []),
    ...(p.image ? [['og:image', p.image]] : []),
    ...(p.image && p.card ? [['og:image:width', '1200'], ['og:image:height', '630']] : []),
    ...(p.url ? [['og:url', p.url]] : []),
  ].map(([property, content]) => `<meta property="${property}" content="${escape(content)}" />`)
  if (p.description) tags.push(`<meta name="description" content="${escape(p.description)}" />`)
  tags.push(`<meta name="twitter:card" content="${p.image ? 'summary_large_image' : 'summary'}" />`)
  return tags.join('\n')
}

async function loadListing(env: Env, slug: string): Promise<PreviewListing | null> {
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY
  if (!env.VITE_SUPABASE_URL || !key) return null
  const query = new URLSearchParams({
    select: 'title,listing_type,price,preview_image_path,property_media!property_media_property_id_fkey(storage_path,media_type,is_cover,display_order)',
    slug: `eq.${slug}`,
    limit: '1',
  })
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/properties?${query}`, {
    headers: { apikey: key },
  })
  if (!res.ok) return null
  const rows = (await res.json()) as PreviewListing[]
  return rows[0] ?? null
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const page = await context.next()
  if (!page.headers.get('content-type')?.includes('text/html')) return page

  const listing = await loadListing(context.env, String(context.params.slug)).catch(() => null)
  if (!listing) return page

  const { origin, pathname } = new URL(context.request.url)
  const preview = { ...listingPreview(listing, context.env.VITE_R2_PUBLIC_URL ?? ''), url: `${origin}${pathname}` }
  return new HTMLRewriter()
    .on('title', { element: (el) => { el.setInnerContent(preview.title) } })
    .on('head', { element: (el) => { el.append(previewTags(preview), { html: true }) } })
    .transform(page)
}
