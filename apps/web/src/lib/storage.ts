const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL as string

export function getMediaUrl(storagePath: string): string {
  return `${R2_PUBLIC_URL}/${storagePath}`
}
