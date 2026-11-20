import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { mediaService } from '../MediaService'
import { propertyService } from '../PropertyService'
import { propertyKeys } from '../queryKeys'
import type { CreatePropertyInput, Property, PropertyMedia, PropertyStatus, UpdatePropertyInput } from '../property.types'

/** Refreshes every list and page that shows properties, and seeds the detail cache when we already have the row. */
function useRefreshProperties() {
  const qc = useQueryClient()
  return (updated?: Property) => {
    if (updated) qc.setQueryData(propertyKeys.detail(updated.id), updated)
    void qc.invalidateQueries({ queryKey: propertyKeys.all })
  }
}

export function useCreateProperty() {
  const refresh = useRefreshProperties()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (data: CreatePropertyInput) => {
      if (!user) throw new Error('You’re signed out. Sign in again to add a property.')
      return propertyService.createProperty(user.id, data)
    },
    onSuccess: (created) => refresh(created),
  })
}

export function useUpdateProperty(id: string) {
  const refresh = useRefreshProperties()
  return useMutation({
    mutationFn: (data: UpdatePropertyInput) => propertyService.updateProperty(id, data),
    onSuccess: (updated) => refresh(updated),
  })
}

export function useSetPropertyStatus() {
  const refresh = useRefreshProperties()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PropertyStatus }) => propertyService.updateProperty(id, { status }),
    onSuccess: (updated) => refresh(updated),
  })
}

export function useSetPropertyVisibility() {
  const refresh = useRefreshProperties()
  return useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) => propertyService.updateProperty(id, { isPublic }),
    onSuccess: (updated) => refresh(updated),
  })
}

export function useDeleteProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => propertyService.deleteProperty(id),
    // Lists only: refetching the deleted property's own page would flash "not found" before it closes.
    onSuccess: () => { void qc.invalidateQueries({ queryKey: propertyKeys.lists }) },
  })
}

export function useUploadMedia(propertyId: string) {
  const refresh = useRefreshProperties()
  return useMutation({
    mutationFn: ({ files, existing }: { files: File[]; existing: PropertyMedia[] }) =>
      mediaService.upload(propertyId, files, existing),
    onSettled: () => refresh(),
  })
}

export function useSetCover(propertyId: string) {
  const refresh = useRefreshProperties()
  return useMutation({
    mutationFn: (mediaId: string) => mediaService.setCover(propertyId, mediaId),
    onSettled: () => refresh(),
  })
}

/** Shows the new room straight away and puts the old one back if saving fails. */
export function useSetMediaCategory(propertyId: string) {
  const qc = useQueryClient()
  const refresh = useRefreshProperties()
  const key = propertyKeys.detail(propertyId)
  return useMutation({
    mutationFn: ({ mediaId, category }: { mediaId: string; category: string }) => mediaService.setCategory(mediaId, category),
    onMutate: async ({ mediaId, category }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Property>(key)
      if (previous) {
        qc.setQueryData<Property>(key, { ...previous, media: previous.media.map((m) => (m.id === mediaId ? { ...m, category } : m)) })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous)
    },
    onSettled: () => refresh(),
  })
}

export function useDeleteMedia() {
  const refresh = useRefreshProperties()
  return useMutation({
    mutationFn: (item: PropertyMedia) => mediaService.remove(item),
    onSettled: () => refresh(),
  })
}
