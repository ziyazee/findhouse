import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/modules/auth/useAuth'
import { useProperties } from '@/modules/properties/hooks/useProperties'
import { LISTING_STATUSES, listingStatus, type ListingStatus } from '@/modules/properties/listingStatus'
import type { Property } from '@/modules/properties/property.types'

export interface IntakeItem {
  id: string
  senderPhone: string
  status: 'COLLECTING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  failureReason: string | null
  propertyId: string | null
  createdAt: string
}

export function useIntake(limit = 30, enabled = true) {
  const { user } = useAuth()
  const brokerId = user?.id ?? ''

  return useQuery({
    queryKey: ['dashboard-intake', brokerId, limit],
    queryFn: async (): Promise<IntakeItem[]> => {
      const { data, error } = await supabase
        .from('whatsapp_submissions')
        .select('id, sender_phone, status, failure_reason, property_id, created_at')
        .eq('broker_id', brokerId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw new Error(error.message)
      return (data ?? []).map((r) => ({
        id: r.id,
        senderPhone: r.sender_phone,
        status: r.status as IntakeItem['status'],
        failureReason: r.failure_reason,
        propertyId: r.property_id,
        createdAt: r.created_at,
      }))
    },
    enabled: enabled && !!brokerId,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

export function useDashboardData({ withIntake = true } = {}) {
  const propsQuery = useProperties()
  const intakeQuery = useIntake(30, withIntake)
  const properties = propsQuery.data

  const summary = useMemo(() => {
    const all: Property[] = properties ?? []
    const byStatus = Object.fromEntries(LISTING_STATUSES.map((s) => [s, 0])) as Record<ListingStatus, number>
    for (const p of all) byStatus[listingStatus(p)]++

    const rentals = all.filter((p) => p.listingType === 'rent')
    const rented = rentals.filter((p) => p.status === 'rented')
    const onMarket = rentals.filter((p) => p.status === 'available')
    const priced = rentals.filter((p) => p.price)
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    return {
      total: all.length,
      byStatus,
      occupancy: rented.length + onMarket.length ? rented.length / (rented.length + onMarket.length) : 0,
      rentRoll: rented.reduce((t, p) => t + (p.price ?? 0), 0),
      avgRent: priced.length ? Math.round(priced.reduce((t, p) => t + (p.price ?? 0), 0) / priced.length) : 0,
      addedThisMonth: all.filter((p) => new Date(p.createdAt) >= monthStart).length,
    }
  }, [properties])

  return {
    isLoading: propsQuery.isLoading,
    isError: propsQuery.isError,
    refetch: propsQuery.refetch,
    summary,
    intake: intakeQuery.data ?? [],
    intakeLoading: intakeQuery.isLoading,
    properties: properties ?? [],
  }
}
