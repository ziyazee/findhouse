import { useState } from 'react'
import { Archive, ExternalLink, KeyRound, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import type { MenuItem } from '@/shared/components/Menu'
import { toast } from '@/shared/components/toastStore'
import { useDeleteProperty, useSetPropertyStatus } from '../hooks/usePropertyMutations'
import { STATUS_TO_DB } from '../listingStatus'
import type { Property, PropertyStatus } from '../property.types'

const STATUS_DONE: Record<PropertyStatus, string> = {
  available: 'Marked as active',
  rented: 'Marked as rented',
  sold: 'Marked as inactive',
}

export function usePropertyActions(onDeleted?: () => void) {
  const [toDelete, setToDelete] = useState<Property | null>(null)
  const del = useDeleteProperty()
  const setStatus = useSetPropertyStatus()

  async function changeStatus(p: Property, status: PropertyStatus) {
    try {
      await setStatus.mutateAsync({ id: p.id, status })
      toast.success(`${STATUS_DONE[status]}: ${p.title}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the status')
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
    items.push({ label: 'View public page', icon: <ExternalLink size={16} />, href: `/p/${p.slug}` })

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

  return { itemsFor, dialog, requestDelete: setToDelete, changeStatus, statusPending: setStatus.isPending }
}
