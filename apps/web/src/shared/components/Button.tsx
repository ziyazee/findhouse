import { type ButtonHTMLAttributes, type ReactNode, type ElementType } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  children: ReactNode
  // Polymorphic — pass `as={Link}` + `to="..."` to render as a router link
  as?: ElementType
  to?: string
  href?: string
  target?: string
  rel?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  as: Component = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    styles.btn,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    loading ? styles.loading : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const isButton = Component === 'button'

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Component
      {...rest}
      className={classes}
      {...(isButton ? { disabled: disabled || loading, 'aria-busy': loading } : {})}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      <span className={loading ? styles.hiddenText : ''}>{children}</span>
    </Component>
  )
}
