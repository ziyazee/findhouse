import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { propertyService } from '../PropertyService'
import { propertyKeys } from '../queryKeys'

/** The signed-in broker's properties, newest first. */
export function useProperties() {
  const { user } = useAuth()
  const brokerId = user?.id ?? ''

  return useQuery({
    queryKey: propertyKeys.list(brokerId),
    queryFn: () => propertyService.getProperties(brokerId),
    enabled: !!brokerId,
    staleTime: 30_000,
  })
}
