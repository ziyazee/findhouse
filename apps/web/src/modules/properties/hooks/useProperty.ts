import { useQuery } from '@tanstack/react-query'
import { propertyService } from '../PropertyService'
import { propertyKeys } from '../queryKeys'

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: propertyKeys.detail(id ?? ''),
    queryFn: () => propertyService.getProperty(id ?? ''),
    enabled: !!id,
    staleTime: 30_000,
  })
}
