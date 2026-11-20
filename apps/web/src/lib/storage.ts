import { env } from './env'

/** Cloudflare Pages function that writes to and deletes from the media bucket (functions/api/upload.ts). */
const UPLOAD_API = '/api/upload'

/**
 * Objects uploaded from the dashboard live under this prefix. WhatsApp media lives under
 * `submissions/` and is shared with the original messages, so it must never be deleted from here.
 * The upload function enforces the same rule on the server.
 */
const DASHBOARD_PREFIX = 'properties/'

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export function getMediaUrl(storagePath: string): string {
  return `${env.mediaBaseUrl}/${storagePath}`
}

/** True for objects the dashboard created and may therefore delete. */
export function isDashboardUpload(storagePath: string): boolean {
  return storagePath.startsWith(DASHBOARD_PREFIX)
}

export function newMediaKey(propertyId: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
  return `${DASHBOARD_PREFIX}${propertyId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
}

export async function uploadObject(key: string, file: File): Promise<void> {
  const form = new FormData()
  form.append('file', file)
  form.append('key', key)
  const res = await fetch(UPLOAD_API, { method: 'POST', body: form })
  if (!res.ok) throw new Error((await res.text()) || `Upload failed (${res.status})`)
}

export async function deleteObject(key: string): Promise<void> {
  const res = await fetch(`${UPLOAD_API}?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error((await res.text()) || `Delete failed (${res.status})`)
}
