import { Globe, Lock } from 'lucide-react'
import { Badge } from '@/shared/components/Badge'
import { VISIBILITY_META, visibilityOf } from '../visibility'
import type { Property } from '../property.types'

export function VisibilityBadge({ property }: { property: Pick<Property, 'isPublic'> }) {
  const v = visibilityOf(property)
  const Icon = v === 'public' ? Globe : Lock
  return (
    <Badge variant="grey" title={VISIBILITY_META[v].hint}>
      <Icon size={12} aria-hidden="true" />
      {VISIBILITY_META[v].label}
    </Badge>
  )
}
