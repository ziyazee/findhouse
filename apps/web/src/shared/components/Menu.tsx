import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import styles from './Menu.module.css'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect?: () => void
  to?: string
  href?: string
  danger?: boolean
  disabled?: boolean
  separatorBefore?: boolean
}

interface MenuProps {
  label: string
  trigger: ReactNode
  items: MenuItem[]
  triggerClassName?: string
  align?: 'start' | 'end'
  placement?: 'below' | 'above'
}

const WIDTH = 216

export function Menu({ label, trigger, items, triggerClassName, align = 'end', placement = 'below' }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const id = useId()

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const height = listRef.current?.offsetHeight ?? 0
    let left = align === 'end' ? r.right - WIDTH : r.left
    left = Math.max(8, Math.min(left, window.innerWidth - WIDTH - 8))
    let top = placement === 'above' ? r.top - height - 6 : r.bottom + 6
    if (placement === 'below' && top + height > window.innerHeight - 8) top = r.top - height - 6
    setPos({ top: Math.max(8, top), left })
    listRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus()
  }, [open, align, placement])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!listRef.current?.contains(t) && !triggerRef.current?.contains(t)) close()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  function onKeyDown(e: React.KeyboardEvent) {
    const els = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])
    const i = els.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      els[(i + 1) % els.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      els[(i - 1 + els.length) % els.length]?.focus()
    }
  }

  function select(item: MenuItem) {
    setOpen(false)
    if (item.href) window.open(item.href, '_blank', 'noopener,noreferrer')
    else if (item.to) navigate(item.to)
    item.onSelect?.()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v) }}
      >
        {trigger}
      </button>
      {open && createPortal(
        <div
          ref={listRef}
          id={id}
          role="menu"
          aria-label={label}
          className={styles.menu}
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: WIDTH }}
          onKeyDown={onKeyDown}
        >
          {items.map((item) => (
            <div key={item.label}>
              {item.separatorBefore && <div className={styles.separator} role="separator" />}
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                className={`${styles.item} ${item.danger ? styles.danger : ''}`}
                onClick={() => select(item)}
              >
                {item.icon && <span className={styles.icon} aria-hidden="true">{item.icon}</span>}
                {item.label}
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
