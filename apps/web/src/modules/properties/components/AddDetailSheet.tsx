import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import styles from './AddDetailSheet.module.css'

interface AddDetailSheetProps {
  open: boolean
  onAdd: (label: string, value: string) => void
  onClose: () => void
}

/** A sheet that slides up from the bottom to add one extra detail (name and value). */
export function AddDetailSheet({ open, onAdd, onClose }: AddDetailSheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      setLabel('')
      setValue('')
      el.removeAttribute('data-closing')
      el.showModal()
      nameRef.current?.focus({ preventScroll: true })
    }
    if (!open && el.open) {
      // Slide down first, then close.
      el.setAttribute('data-closing', '')
      const t = window.setTimeout(() => { el.close(); el.removeAttribute('data-closing') }, 480)
      return () => window.clearTimeout(t)
    }
  }, [open])

  // Lift the sheet above the on-screen keyboard: the visual viewport shrinks by the keyboard's height.
  useEffect(() => {
    const el = ref.current
    const vv = window.visualViewport
    if (!open || !el || !vv) return
    const lift = () => {
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      el.style.setProperty('--keyboard', `${Math.round(keyboard)}px`)
    }
    lift()
    vv.addEventListener('resize', lift)
    vv.addEventListener('scroll', lift)
    return () => {
      vv.removeEventListener('resize', lift)
      vv.removeEventListener('scroll', lift)
      el.style.removeProperty('--keyboard')
    }
  }, [open])

  const ready = label.trim() !== '' && value.trim() !== ''

  function submit() {
    if (!ready) return
    onAdd(label.trim(), value.trim())
  }

  // The sheet sits inside the property form, so Enter must add the detail, not submit the whole form.
  function onEnter(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    submit()
  }

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
    >
      <div className={styles.grab} aria-hidden="true" />
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>Add a detail</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Name</span>
          <input ref={nameRef} value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={onEnter} placeholder="e.g. Facing" />
        </label>
        <label className={styles.field}>
          <span>Value</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onEnter} placeholder="e.g. East" />
        </label>
      </div>
      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={submit} disabled={!ready}>Add detail</Button>
      </div>
    </dialog>
  )
}
