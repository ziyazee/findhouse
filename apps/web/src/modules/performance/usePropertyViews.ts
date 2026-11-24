import { useMemo } from 'react'
import { usePerformanceStats } from './usePerformanceStats'

export interface PropertyCounts {
  views: number
  whatsapp: number
  calls: number
}

const NONE: PropertyCounts = { views: 0, whatsapp: 0, calls: 0 }

/** Views and Call / WhatsApp taps for each of the broker's listings over the last year, by property id. */
export function usePropertyViews() {
  const stats = usePerformanceStats(365)
  const counts = useMemo(() => {
    const map = new Map<string, PropertyCounts>()
    for (const r of stats.data ?? []) {
      const c = map.get(r.property_id) ?? { ...NONE }
      const n = Number(r.n)
      if (r.kind === 'view') c.views += n
      else if (r.kind === 'whatsapp') c.whatsapp += n
      else if (r.kind === 'call') c.calls += n
      map.set(r.property_id, c)
    }
    return map
  }, [stats.data])
  return { counts, of: (id: string): PropertyCounts => counts.get(id) ?? NONE, isLoading: stats.isLoading }
}
