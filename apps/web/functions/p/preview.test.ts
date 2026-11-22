import { describe, expect, it } from 'vitest'
import { listingPreview, previewTags, type PreviewListing } from './[slug]'

const listing: PreviewListing = {
  title: 'Spacious 1BHK at SJR Palaza City',
  listing_type: 'rent',
  price: 25000,
  property_media: [
    { storage_path: 'submissions/s/2.jpg', media_type: 'image', is_cover: false, display_order: 1 },
    { storage_path: 'submissions/s/v.mp4', media_type: 'video', is_cover: false, display_order: 0 },
    { storage_path: 'submissions/s/1.jpg', media_type: 'image', is_cover: true, display_order: 2 },
  ],
}

describe('listing preview', () => {
  it('is the listing name, the monthly rent and the cover photo', () => {
    expect(listingPreview(listing, 'https://media.findhouse.in/')).toEqual({
      title: 'Spacious 1BHK at SJR Palaza City',
      description: '₹25,000 a month',
      image: 'https://media.findhouse.in/submissions/s/1.jpg',
    })
  })

  it('shows the preview image the edge function made', () => {
    const p = listingPreview({ ...listing, preview_image_path: 'previews/flat-x1-abc.jpg' }, 'https://m')
    expect(p.image).toBe('https://m/previews/flat-x1-abc.jpg')
    expect(previewTags(p)).toContain('<meta property="og:image" content="https://m/previews/flat-x1-abc.jpg" />')
  })

  it('words a sale price, and has no photo when none was sent', () => {
    const p = listingPreview({ ...listing, listing_type: 'sale', price: 8500000, property_media: [] }, 'https://m')
    expect(p.description).toBe('₹85 lakh')
    expect(p.image).toBeNull()
  })

  it('leaves the description out when there is no price', () => {
    const p = listingPreview({ ...listing, price: null }, 'https://m')
    expect(previewTags(p)).not.toContain('description')
  })

  it('uses the first photo when none is the cover, never a video', () => {
    const media = listing.property_media!.map((m) => ({ ...m, is_cover: false }))
    expect(listingPreview({ ...listing, property_media: media }, 'https://m').image).toBe('https://m/submissions/s/2.jpg')
  })

  it('escapes text in the tags', () => {
    const tags = previewTags({ title: 'A "quiet" <home> & more', description: 'd', image: null })
    expect(tags).toContain('content="A &quot;quiet&quot; &lt;home&gt; &amp; more"')
    expect(tags).not.toContain('og:image')
  })

  it('gives the page address when it has one', () => {
    const tags = previewTags({ title: 't', description: 'd', image: null, url: 'https://findhouse.in/p/x' })
    expect(tags).toContain('<meta property="og:url" content="https://findhouse.in/p/x" />')
  })
})
