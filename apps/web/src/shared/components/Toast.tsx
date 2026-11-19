import { CircleCheck, CircleAlert, X } from 'lucide-react'
import { useToastStore } from './toastStore'
import styles from './Toast.module.css'

export function Toaster() {
  const items = useToastStore((s) => s.items)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.tone]}`}>
          {t.tone === 'success'
            ? <CircleCheck size={18} aria-hidden="true" className={styles.icon} />
            : <CircleAlert size={18} aria-hidden="true" className={styles.icon} />}
          <p className={styles.message}>{t.message}</p>
          <button className={styles.close} onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}
