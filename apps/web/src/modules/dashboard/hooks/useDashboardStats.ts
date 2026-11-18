import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/modules/auth/useAuth'

export interface DashboardStats {
  total: number
  available: number
  sold: number
  rented: number
  addedThisMonth: number
  activeSessions: number
  completedThisMonth: number
}

export function useDashboardStats() {
  const { user } = useAuth()
  const brokerId = user?.id ?? ''

  return useQuery({
    queryKey: ['dashboard-stats', brokerId],
    queryFn: async (): Promise<DashboardStats> => {
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const [propertiesRes, sessionsRes, completedRes] = await Promise.all([
        supabase
          .from('properties')
          .select('id, status, created_at')
          .eq('broker_id', brokerId),
        supabase
          .from('whatsapp_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('broker_id', brokerId)
          .eq('status', 'COLLECTING'),
        supabase
          .from('whatsapp_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('broker_id', brokerId)
          .eq('status', 'COMPLETED')
          .gte('completed_at', monthStart.toISOString()),
      ])

      const props = propertiesRes.data ?? []

      return {
        total: props.length,
        available: props.filter((p) => p.status === 'available').length,
        sold: props.filter((p) => p.status === 'sold').length,
        rented: props.filter((p) => p.status === 'rented').length,
        addedThisMonth: props.filter(
          (p) => new Date(p.created_at) >= monthStart,
        ).length,
        activeSessions: sessionsRes.count ?? 0,
        completedThisMonth: completedRes.count ?? 0,
      }
    },
    enabled: !!brokerId,
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
}
