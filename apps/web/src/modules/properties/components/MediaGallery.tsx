import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getMediaUrl } from '@/lib/storage'
import { Button } from '@/shared/components/Button'
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
  }

  async function handleSetCover(mediaId: string) {
    await supabase.from('property_media').update({ is_cover: false }).eq('property_id', propertyId)
    await supabase.from('property_media').update({ is_cover: true }).eq('id', mediaId)
    onUpdate()
  }

  async function handleDelete(item: PropertyMedia) {
    await fetch(`${UPLOAD_API}?key=${encodeURIComponent(item.storagePath)}`, { method: 'DELETE' })
    await supabase.from('property_media').delete().eq('id', item.id)
    onUpdate()
  }

  return (
    <div className={styles.root}>
      {/* Upload zone */}
      <div
        className={styles.uploadZone}
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
      >
        <UploadIcon />
        <p className={styles.uploadText}>
          {uploading ? 'Uploading…' : 'Drop photos/videos here, or click to browse'}
        </p>
        <p className={styles.uploadHint}>JPG, PNG, MP4 · max 50MB each</p>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

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

                {item.isCover && <span className={styles.coverBadge}>Cover</span>}

                <div className={styles.actions}>
                  {!item.isCover && (
                    <Button size="sm" variant="secondary" onClick={() => handleSetCover(item.id)}>
                      Set cover
                    </Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => handleDelete(item)}>
                    <TrashIcon />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {sorted.length === 0 && !uploading && (
        <p className={styles.empty}>No media yet.</p>
      )}
    </div>
  )
}

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}
