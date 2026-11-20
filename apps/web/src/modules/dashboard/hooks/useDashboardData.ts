import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useProperties } from '@/modules/properties/hooks/useProperties'
import { submissionService } from '@/modules/submissions/SubmissionService'
import { summarizePortfolio } from '../portfolioSummary'

export function useIntake(limit = 30, enabled = true) {
  const { user } = useAuth()
  const brokerId = user?.id ?? ''

  return useQuery({
    queryKey: ['submissions', 'intake', brokerId, limit],
    queryFn: () => submissionService.listForBroker(brokerId, limit),
    enabled: enabled && !!brokerId,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

export function useDashboardData({ withIntake = true } = {}) {
  const propsQuery = useProperties()
  const intakeQuery = useIntake(30, withIntake)
  const properties = propsQuery.data

  const summary = useMemo(() => summarizePortfolio(properties ?? []), [properties])

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
