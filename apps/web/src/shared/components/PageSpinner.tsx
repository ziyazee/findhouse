import styles from './PageSpinner.module.css'

/** Full-screen spinner while a page's code is loading. */
export function PageSpinner() {
  return (
    <div className={styles.wrap}>
      <div className="spinner" />
    </div>
  )
}
