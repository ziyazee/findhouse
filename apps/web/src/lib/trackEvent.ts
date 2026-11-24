import { supabase } from './supabase'

export type EventKind = 'view' | 'share' | 'call' | 'whatsapp'

const seen = new Set<string>()

/**
 * Tells FindHouse a listing was viewed, shared, or that someone tapped Call or WhatsApp on it. Fire and forget: it never
 * throws or slows the page. A view counts once per listing per browser tab, so refreshing doesn't inflate it.
 */
export function trackEvent(propertyId: string, kind: EventKind): void {
  if (kind === 'view') {
    if (seen.has(propertyId)) return
    seen.add(propertyId)
  }
  void Promise.resolve(supabase.rpc('track_property_event', { pid: propertyId, event_kind: kind })).catch(() => undefined)
}
