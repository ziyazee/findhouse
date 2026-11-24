import { useState } from 'react'
import { Archive, ExternalLink, Globe, KeyRound, Lock, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import type { MenuItem } from '@/shared/components/Menu'
import { toast } from '@/shared/components/toastStore'
import { useDeleteProperty, useSetPropertyStatus, useSetPropertyVisibility } from '../hooks/usePropertyMutations'
import { STATUS_TO_DB } from '../listingStatus'
import type { Property, PropertyStatus } from '../property.types'
import { useMySite } from '@/modules/broker-site/useBrokerSite'

export function usePropertyActions(onDeleted?: () => void) {
  const [toDelete, setToDelete] = useState<Property | null>(null)
  const del = useDeleteProperty()
  const setStatus = useSetPropertyStatus()
  const setVisibility = useSetPropertyVisibility()
  const site = useMySite()

  async function changeStatus(p: Property, status: PropertyStatus) {
    try {
      await setStatus.mutateAsync({ id: p.id, status })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the status')
    }
  }

  async function changeVisibility(p: Property, isPublic: boolean) {
    try {
      await setVisibility.mutateAsync({ id: p.id, isPublic })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not change who can see it')
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await del.mutateAsync(toDelete.id)
      toast.success(`Deleted ${toDelete.title}`)
      setToDelete(null)
      onDeleted?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the property')
    }
  }

  function itemsFor(p: Property, { includeEdit = true } = {}): MenuItem[] {
    const items: MenuItem[] = []
    if (includeEdit) items.push({ label: 'Edit details', icon: <Pencil size={16} />, to: `/properties/${p.id}` })
    items.push({ label: 'View public page', icon: <ExternalLink size={16} />, href: site.listingUrl(p) })
    items.push(p.isPublic
      ? { label: 'Make private', icon: <Lock size={16} />, onSelect: () => changeVisibility(p, false) }
      : { label: 'Make public', icon: <Globe size={16} />, onSelect: () => changeVisibility(p, true) })

    const statusItems: MenuItem[] = []
    if (p.status !== 'available') {
      statusItems.push({ label: 'Mark as active', icon: <RotateCcw size={16} />, onSelect: () => changeStatus(p, STATUS_TO_DB.active) })
    }
    if (p.status !== 'rented' && p.listingType === 'rent') {
      statusItems.push({ label: 'Mark as rented', icon: <KeyRound size={16} />, onSelect: () => changeStatus(p, STATUS_TO_DB.rented) })
    }
    if (p.status !== 'sold') {
      statusItems.push({
        label: p.listingType === 'sale' ? 'Mark as sold' : 'Mark as inactive',
        icon: <Archive size={16} />,
        onSelect: () => changeStatus(p, STATUS_TO_DB.inactive),
      })
    }
    if (statusItems.length) statusItems[0].separatorBefore = true

    return [
      ...items,
      ...statusItems,
      { label: 'Delete', icon: <Trash2 size={16} />, danger: true, separatorBefore: true, onSelect: () => setToDelete(p) },
    ]
  }

  const dialog = (
    <ConfirmDialog
      open={!!toDelete}
      tone="danger"
      title="Delete this property?"
      description={
        <>
          <strong>{toDelete?.title}</strong> and its photos will be removed permanently.
          The original WhatsApp messages are kept.
        </>
      }
      confirmLabel="Delete property"
      loading={del.isPending}
      onConfirm={confirmDelete}
      onCancel={() => setToDelete(null)}
    />
  )

  return {
    itemsFor,
    dialog,
    requestDelete: setToDelete,
    changeStatus,
    changeVisibility,
    statusPending: setStatus.isPending,
    visibilityPending: setVisibility.isPending,
  }
}
