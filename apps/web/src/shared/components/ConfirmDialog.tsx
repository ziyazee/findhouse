import { useEffect, useId, useRef, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from './Button'
import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  tone?: 'danger' | 'default'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open, title, description, confirmLabel, tone = 'default', loading = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); if (!loading) onCancel() }}
      onClick={(e) => { if (e.target === ref.current && !loading) onCancel() }}
    >
      <div className={styles.body}>
        {tone === 'danger' && (
          <span className={styles.icon}><TriangleAlert size={20} aria-hidden="true" /></span>
        )}
        <div>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <div className={styles.description}>{description}</div>
        </div>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel} disabled={loading} autoFocus={tone === 'danger'}>Cancel</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} autoFocus={tone !== 'danger'}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
