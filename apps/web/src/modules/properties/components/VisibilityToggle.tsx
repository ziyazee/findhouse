import { Globe, Lock } from 'lucide-react'
import { toast } from '@/shared/components/toastStore'
import { useSetPropertyVisibility } from '../hooks/usePropertyMutations'
import { VISIBILITY_META, visibilityOf } from '../visibility'
import type { Property } from '../property.types'
import styles from './VisibilityToggle.module.css'

/** The Public / Private badge as a button: one click changes it and it's saved straight away, with no save button. */
export function VisibilityToggle({ property }: { property: Pick<Property, 'id' | 'title' | 'isPublic'> }) {
  const set = useSetPropertyVisibility()
  const v = visibilityOf(property)
  const Icon = v === 'public' ? Globe : Lock

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
      title={`${VISIBILITY_META[v].hint}. Click to make it ${v === 'public' ? 'private' : 'public'}.`}
      className={`${styles.toggle} ${property.isPublic ? styles.public : styles.private}`}
      onClick={toggle}
    >
      <Icon size={12} aria-hidden="true" />
      {VISIBILITY_META[v].label}
    </button>
  )
}
