import { useQuery } from '@tanstack/react-query'
import { createPropertyService } from '../PropertyService'
import { useAuth } from '@/modules/auth/useAuth'

const svc = createPropertyService()

export const PROPERTIES_KEY = 'properties'

export function useProperties() {
  const { user } = useAuth()
  const brokerId = user?.id ?? ''

  return useQuery({
    queryKey: [PROPERTIES_KEY, brokerId],
    queryFn: () => svc.getProperties(brokerId),
    enabled: !!brokerId,
    staleTime: 30_000,
  })
}
