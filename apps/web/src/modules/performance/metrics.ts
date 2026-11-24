import type { Property } from '@/modules/properties/property.types'

/** One row from `broker_property_stats`: how many events of a kind a listing had on a day. */
export interface StatRow {
  property_id: string
  kind: string
  day: string
  n: number
}

export interface Totals {
  views: number
  shares: number
  calls: number
  whatsapp: number
  /** Taps on Call or WhatsApp. */
  enquiries: number
}

const EMPTY: Totals = { views: 0, shares: 0, calls: 0, whatsapp: 0, enquiries: 0 }

function add(t: Totals, kind: string, n: number): Totals {
  const next = { ...t }
  if (kind === 'view') next.views += n
  else if (kind === 'share') next.shares += n
  else if (kind === 'call') next.calls += n
  else if (kind === 'whatsapp') next.whatsapp += n
  else return t
  next.enquiries = next.calls + next.whatsapp
  return next
}

export function totalsOf(rows: StatRow[]): Totals {
  return rows.reduce((t, r) => add(t, r.kind, Number(r.n)), EMPTY)
}

/** Share of views that ended in a call or WhatsApp tap; null until there is a view. */
export function enquiryRate(t: Totals): number | null {
  return t.views ? t.enquiries / t.views : null
}

export interface DayStat {
  key: string
  label: string
  views: number
  enquiries: number
}

const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Views and enquiries for each of the last `days` days, oldest first, with zero-days included. */
export function perDay(rows: StatRow[], days: number, now = new Date()): DayStat[] {
  const list: DayStat[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - i))
    return { key: dayKey(d), label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), views: 0, enquiries: 0 }
  })
  const byKey = new Map(list.map((d) => [d.key, d]))
  for (const r of rows) {
    const d = byKey.get(r.day)
    if (!d) continue
    if (r.kind === 'view') d.views += Number(r.n)
    else if (r.kind === 'call' || r.kind === 'whatsapp') d.enquiries += Number(r.n)
  }
  return list
}

export interface PropertyStat extends Totals {
  id: string
  title: string
}

/** Every property with its totals, best first: most enquiries, then most views. Properties with no activity are last. */
export function perProperty(rows: StatRow[], properties: Pick<Property, 'id' | 'title'>[]): PropertyStat[] {
  const byId = new Map<string, Totals>()
  for (const r of rows) byId.set(r.property_id, add(byId.get(r.property_id) ?? EMPTY, r.kind, Number(r.n)))
  return properties
    .map((p) => ({ id: p.id, title: p.title, ...(byId.get(p.id) ?? EMPTY) }))
    .sort((a, b) => b.enquiries - a.enquiries || b.views - a.views || a.title.localeCompare(b.title))
}
