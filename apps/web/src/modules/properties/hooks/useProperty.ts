import { useQuery } from '@tanstack/react-query'
import { createPropertyService } from '../PropertyService'

const svc = createPropertyService()

export const PROPERTY_KEY = 'property'

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: [PROPERTY_KEY, id],
    queryFn: () => svc.getProperty(id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}
