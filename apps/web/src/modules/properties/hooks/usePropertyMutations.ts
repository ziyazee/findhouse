import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPropertyService } from '../PropertyService'
import { useAuth } from '@/modules/auth/useAuth'
import type { CreatePropertyInput, UpdatePropertyInput } from '../property.types'
import { PROPERTIES_KEY } from './useProperties'
import { PROPERTY_KEY } from './useProperty'

const svc = createPropertyService()

export function useCreateProperty() {
  const qc = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (data: CreatePropertyInput) =>
      svc.createProperty(user?.id ?? '', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROPERTIES_KEY] })
    },
  })
}

export function useUpdateProperty(id: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdatePropertyInput) => svc.updateProperty(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: [PROPERTIES_KEY] })
      qc.setQueryData([PROPERTY_KEY, id], updated)
    },
  })
}

export function useDeleteProperty() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => svc.deleteProperty(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROPERTIES_KEY] })
    },
  })
}
