import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { getMediaUrl } from '@/lib/storage'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { titleCase } from '@/shared/format'
import { roomChoices, toRoomCategory } from '../mediaRooms'
import type { PropertyMedia } from '../property.types'
import styles from './RoomPicker.module.css'

interface RoomPickerProps {
  /** The photo being tagged; the picker is open while this is set. */
  item: PropertyMedia | null
  onPick: (category: string) => void
  onClose: () => void
}

export function RoomPicker({ item, onPick, onClose }: RoomPickerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [custom, setCustom] = useState('')
  const [customError, setCustomError] = useState('')
  const current = item?.category?.toUpperCase() ?? null

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (item && !el.open) {
      setCustom('')
      setCustomError('')
      el.showModal()
    }
    if (!item && el.open) el.close()
  }, [item])

  function submitCustom(e: React.FormEvent) {
    e.preventDefault()
    const category = toRoomCategory(custom)
    if (category) onPick(category)
    else setCustomError('Type a room name, e.g. Study.')
  }

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
    >
      <div className={styles.head}>
        {item && <img src={getMediaUrl(item.storagePath)} alt="" className={styles.thumb} />}
        <div className={styles.headText}>
          <h2 id={titleId} className={styles.title}>Which room is this?</h2>
          <p className={styles.subtitle}>The public page groups photos by room.</p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.chips} role="group" aria-labelledby={titleId}>
        {roomChoices(current).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={current === c}
            className={`${styles.chip} ${current === c ? styles.chipActive : ''}`}
            onClick={() => onPick(c)}
          >
            {titleCase(c)}
          </button>
        ))}
      </div>

      <form className={styles.custom} onSubmit={submitCustom} noValidate>
        <Input
          label="Another room"
          value={custom}
          onChange={(e) => { setCustom(e.target.value); setCustomError('') }}
          placeholder="e.g. Study, Pooja room"
          maxLength={30}
          error={customError}
        />
        <Button type="submit" variant="secondary">Use</Button>
      </form>
    </dialog>
  )
}
