import { useRef, useState } from 'react'
import { getMediaUrl } from '@/lib/storage'
import { ImagePlus, Pencil, Star, Tag, Trash2, Upload } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { toast } from '@/shared/components/toastStore'
import { useDeleteMedia, useSetCover, useSetMediaCategory, useUploadMedia } from '../hooks/usePropertyMutations'
import { roomName } from '../mediaRooms'
import type { PropertyMedia } from '../property.types'
import { RoomPicker } from './RoomPicker'
import styles from './MediaGallery.module.css'

interface MediaGalleryProps {
  propertyId: string
  media: PropertyMedia[]
}

export function MediaGallery({ propertyId, media }: MediaGalleryProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState<PropertyMedia | null>(null)
  const [toTag, setToTag] = useState<PropertyMedia | null>(null)
  const upload = useUploadMedia(propertyId)
  const setCover = useSetCover(propertyId)
  const setCategory = useSetMediaCategory(propertyId)
  const remove = useDeleteMedia()
  const uploading = upload.isPending

  const sorted = [...media].sort((a, b) => a.displayOrder - b.displayOrder)

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || uploading) return
    setError('')
    try {
      const { failures } = await upload.mutateAsync({ files: Array.from(files), existing: media })
      if (failures.length) setError(`Some files weren’t added. ${failures.join('. ')}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Please try again.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function handleSetCover(mediaId: string) {
    try {
      await setCover.mutateAsync(mediaId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t change the cover photo')
    }
  }

  async function handlePickRoom(item: PropertyMedia, category: string) {
    setToTag(null)
    if (item.category?.toUpperCase() === category) return
    try {
      await setCategory.mutateAsync({ mediaId: item.id, category })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t change the room. Please try again.')
    }
  }

  async function handleDelete(item: PropertyMedia) {
    try {
      await remove.mutateAsync(item)
      toast.success(item.mediaType === 'video' ? 'Video removed' : 'Photo removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t remove it. Please try again.')
    } finally {
      setToDelete(null)
    }
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
            const room = roomName(item.category)

            return (
              <div key={item.id} className={`${styles.item} ${item.isCover ? styles.coverItem : ''}`}>
                {isVideo ? (
                  <video src={url} className={styles.thumb} muted playsInline />
                ) : (
                  <img src={url} alt="" className={styles.thumb} loading="lazy" />
                )}

                {item.isCover && (
                  <span className={styles.coverBadge} aria-label="Cover">
                    <Star size={12} aria-hidden="true" /><span className={styles.coverText}>Cover</span>
                  </span>
                )}
                {!isVideo && (
                  <button
                    type="button"
                    className={`${styles.roomTag} ${room ? '' : styles.roomTagEmpty}`}
                    onClick={() => setToTag(item)}
                    aria-label={room ? `Room: ${room}. Change room` : 'Choose a room for this photo'}
                  >
                    {room ? <Pencil size={12} aria-hidden="true" /> : <Tag size={12} aria-hidden="true" />}
                    <span>{room ?? 'Add room'}</span>
                  </button>
                )}

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

      <RoomPicker item={toTag} onPick={(c) => toTag && handlePickRoom(toTag, c)} onClose={() => setToTag(null)} />

      <ConfirmDialog
        open={!!toDelete}
        tone="danger"
        title={toDelete?.mediaType === 'video' ? 'Delete this video?' : 'Delete this photo?'}
        description="It will be removed from the property and its public page."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => toDelete && handleDelete(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
