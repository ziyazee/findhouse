import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { supabase } from '@/lib/supabase'
import type { StatRow } from './metrics'

/** The signed-in broker's views, shares and enquiries for the last `days` days, counted per listing and day. */
export function usePerformanceStats(days: number) {
  const { user } = useAuth()
  const brokerId = user?.id ?? ''

  return useQuery({
    queryKey: ['performance', brokerId, days],
    queryFn: async (): Promise<StatRow[]> => {
      const { data, error } = await supabase.rpc('broker_property_stats', { days })
      if (error) throw new Error(error.message)
      return (data ?? []).map((r) => ({ ...r, n: Number(r.n) }))
    },
    enabled: !!brokerId,
    staleTime: 60_000,
  })
}
