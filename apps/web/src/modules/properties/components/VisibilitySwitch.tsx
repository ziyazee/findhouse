import { toast } from '@/shared/components/toastStore'
import { useSetPropertyVisibility } from '../hooks/usePropertyMutations'
import type { Property } from '../property.types'
import styles from './VisibilitySwitch.module.css'

/** A small on/off switch for Public / Private. One tap saves it. */
export function VisibilitySwitch({ property, large = false }: { property: Pick<Property, 'id' | 'title' | 'isPublic'>; large?: boolean }) {
  const set = useSetPropertyVisibility()

  function toggle() {
    if (set.isPending) return
    set.mutate(
      { id: property.id, isPublic: !property.isPublic },
      { onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not change who can see it') },
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={property.isPublic}
      aria-label={`Public listing: ${property.title}`}
      className={`${styles.root} ${large ? styles.large : ''}`}
      onClick={toggle}
    >
      <span className={styles.track} aria-hidden="true"><span className={styles.thumb} /></span>
      {property.isPublic ? 'Public' : 'Private'}
    </button>
  )
}
