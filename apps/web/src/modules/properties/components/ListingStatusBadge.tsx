import { Badge } from '@/shared/components/Badge'
import { STATUS_META, listingStatus } from '../listingStatus'
import type { Property } from '../property.types'

export function ListingStatusBadge({ property }: { property: Property }) {
  const s = listingStatus(property)
  const meta = STATUS_META[s]
  const label = s === 'inactive' && property.listingType === 'sale' ? 'Sold' : meta.label
  return <Badge variant={meta.variant} dot title={meta.hint}>{label}</Badge>
}
