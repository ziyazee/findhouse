import { supabase } from '@/lib/supabase'
import { MAX_UPLOAD_BYTES, deleteObject, isDashboardUpload, newMediaKey, uploadObject } from '@/lib/storage'
import type { PropertyMedia } from './property.types'

export interface UploadResult {
  uploaded: number
  /** One readable message per file that didn't make it. */
  failures: string[]
}

export interface IMediaService {
  /** Uploads files in order after the existing media; the first one becomes the cover if there is none. */
  upload(propertyId: string, files: File[], existing: PropertyMedia[]): Promise<UploadResult>
  setCover(propertyId: string, mediaId: string): Promise<void>
  /** Moves a photo to another room. A category set here is never overwritten by the classifier, which only tags untagged photos. */
  setCategory(mediaId: string, category: string): Promise<void>
  remove(item: PropertyMedia): Promise<void>
}

class SupabaseMediaService implements IMediaService {
  async upload(propertyId: string, files: File[], existing: PropertyMedia[]): Promise<UploadResult> {
    const failures: string[] = []
    let order = existing.reduce((max, m) => Math.max(max, m.displayOrder + 1), 0)
    let hasCover = existing.some((m) => m.isCover)
    let uploaded = 0

    for (const file of files) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        failures.push(`${file.name}: only photos and videos can be added`)
        continue
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        failures.push(`${file.name}: larger than 50 MB`)
        continue
      }

      const key = newMediaKey(propertyId, file.name)
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image'
      try {
        await uploadObject(key, file)
        const { error } = await supabase.from('property_media').insert({
          property_id: propertyId,
          media_type: mediaType,
          storage_path: key,
          display_order: order,
          is_cover: !hasCover && mediaType === 'image',
        })
        if (error) {
          await deleteObject(key).catch(() => {})
          throw new Error(error.message)
        }
        order++
        uploaded++
        if (mediaType === 'image') hasCover = true
      } catch (e) {
        failures.push(`${file.name}: ${e instanceof Error ? e.message : 'upload failed'}`)
      }
    }

    return { uploaded, failures }
  }

  async setCover(propertyId: string, mediaId: string): Promise<void> {
    // Mark the new cover first so a failure part-way never leaves the property without one.
    const { error } = await supabase.from('property_media').update({ is_cover: true }).eq('id', mediaId)
    if (error) throw new Error(error.message)
    const { error: clearError } = await supabase
      .from('property_media')
      .update({ is_cover: false })
      .eq('property_id', propertyId)
      .neq('id', mediaId)
    if (clearError) throw new Error(clearError.message)
  }

  async setCategory(mediaId: string, category: string): Promise<void> {
    const { error } = await supabase.from('property_media').update({ category }).eq('id', mediaId)
    if (error) throw new Error(error.message)
  }

  async remove(item: PropertyMedia): Promise<void> {
    const { error } = await supabase.from('property_media').delete().eq('id', item.id)
    if (error) throw new Error(error.message)
    // WhatsApp media is shared with the original message, so only dashboard uploads are deleted.
    // A failed object delete only leaves an unused file behind; the photo is already gone from the listing.
    if (isDashboardUpload(item.storagePath)) await deleteObject(item.storagePath).catch(() => {})
  }
}

export const mediaService: IMediaService = new SupabaseMediaService()
