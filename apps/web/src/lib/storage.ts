import { supabase } from './supabase'

const BUCKET = 'property-media'
const SIGNED_URL_TTL = 60 * 60 // 1 hour

/**
 * Returns a signed URL for a private storage path.
 * Returns null if the path is empty or the request fails.
 */
export async function getSignedUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL)

  if (error) {
    console.warn('[storage] Failed to get signed URL for', storagePath, error.message)
    return null
  }

  return data.signedUrl
}

/**
 * Returns signed URLs for multiple paths in one call.
 * Paths that fail are returned as null in the same index position.
 */
export async function getSignedUrls(
  storagePaths: string[],
): Promise<(string | null)[]> {
  const valid = storagePaths.filter(Boolean)
  if (valid.length === 0) return storagePaths.map(() => null)

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(valid, SIGNED_URL_TTL)

  if (error) {
    console.warn('[storage] Failed to get signed URLs:', error.message)
    return storagePaths.map(() => null)
  }

  // Re-map to original order (including empty paths)
  const urlMap = new Map(
    (data ?? []).map((item) => [item.path, item.signedUrl ?? null]),
  )

  return storagePaths.map((p) => (p ? (urlMap.get(p) ?? null) : null))
}
