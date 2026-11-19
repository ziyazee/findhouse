import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getMediaUrl } from '@/lib/storage'
import { ImagePlus, Star, Trash2, Upload } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { toast } from '@/shared/components/toastStore'
import type { PropertyMedia } from '../property.types'
import styles from './MediaGallery.module.css'

const UPLOAD_API = '/api/upload'

interface MediaGalleryProps {
  propertyId: string
  media: PropertyMedia[]
  onUpdate: () => void
}

export function MediaGallery({ propertyId, media, onUpdate }: MediaGalleryProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState<PropertyMedia | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sorted = [...media].sort((a, b) => a.displayOrder - b.displayOrder)

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError('')

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `properties/${propertyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const form = new FormData()
      form.append('file', file)
      form.append('key', path)

      const res = await fetch(UPLOAD_API, { method: 'POST', body: form })
      if (!res.ok) {
        setError(`Upload failed: ${await res.text()}`)
        continue
      }

      const mediaType = file.type.startsWith('video') ? 'video' : 'image'
      const isFirstMedia = media.length === 0

      await supabase.from('property_media').insert({
        property_id: propertyId,
        media_type: mediaType,
        storage_path: path,
        display_order: media.length,
        is_cover: isFirstMedia,
      })
    }

    setUploading(false)
    onUpdate()
    if (fileInput.current) fileInput.current.value = ''
  }

  async function handleSetCover(mediaId: string) {
    await supabase.from('property_media').update({ is_cover: false }).eq('property_id', propertyId)
    await supabase.from('property_media').update({ is_cover: true }).eq('id', mediaId)
    onUpdate()
    toast.success('Cover photo updated')
  }

  async function handleDelete(item: PropertyMedia) {
    setDeleting(true)
    await fetch(`${UPLOAD_API}?key=${encodeURIComponent(item.storagePath)}`, { method: 'DELETE' })
    const { error: dbError } = await supabase.from('property_media').delete().eq('id', item.id)
    setDeleting(false)
    setToDelete(null)
    onUpdate()
    if (dbError) toast.error(dbError.message)
    else toast.success(item.mediaType === 'video' ? 'Video removed' : 'Photo removed')
  }

  return (
    <div className={styles.root}>
      {/* Upload zone */}
      <label
        className={`${styles.uploadZone} ${uploading ? styles.uploading : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
      >
        <span className={styles.uploadIcon} aria-hidden="true">
          {uploading ? <span className="spinner" /> : <Upload size={20} />}
        </span>
        <span className={styles.uploadText}>
          {uploading ? 'Uploading…' : (
            <>
              <span className={styles.desktopText}><strong>Click to upload</strong> or drag photos and videos here</span>
              <span className={styles.phoneText}><strong>Tap to add photos or videos</strong></span>
            </>
          )}
        </span>
        <span className={styles.uploadHint}>JPG, PNG or MP4, up to 50 MB each</span>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*"
          multiple
          className="sr-only"
          disabled={uploading}
          onChange={(e) => handleUpload(e.target.files)}
        />
      </label>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {/* Grid */}
      {sorted.length > 0 && (
        <div className={styles.grid}>
          {sorted.map((item) => {
            const isVideo = item.mediaType === 'video'
            const url = getMediaUrl(item.storagePath)

            return (
              <div key={item.id} className={`${styles.item} ${item.isCover ? styles.coverItem : ''}`}>
                {isVideo ? (
                  <video src={url} className={styles.thumb} muted playsInline />
                ) : (
                  <img src={url} alt="" className={styles.thumb} loading="lazy" />
                )}

                {item.isCover && <span className={styles.coverBadge}><Star size={12} aria-hidden="true" />Cover</span>}

                <div className={styles.actions}>
                  {!item.isCover && !isVideo ? (
                    <Button size="sm" variant="secondary" onClick={() => handleSetCover(item.id)}>
                      Set as cover
                    </Button>
                  ) : <span />}
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    aria-label={isVideo ? 'Delete video' : 'Delete photo'}
                    onClick={() => setToDelete(item)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {sorted.length === 0 && !uploading && (
        <p className={styles.empty}>
          <ImagePlus size={16} aria-hidden="true" />
          No photos yet. Properties with photos get far more enquiries.
        </p>
      )}

      <ConfirmDialog
        open={!!toDelete}
        tone="danger"
        title={toDelete?.mediaType === 'video' ? 'Delete this video?' : 'Delete this photo?'}
        description="It will be removed from the property and its public page."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={() => toDelete && handleDelete(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
