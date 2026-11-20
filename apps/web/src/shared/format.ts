export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "SEMI_FURNISHED" or "semi-furnished" → "Semi-furnished". */
export function titleCase(s: string) {
  const t = s.replace(/_+/g, ' ').trim().toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Up to two initials for an avatar, e.g. "Ravi Kumar" → "RK". */
export function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
}

/** Rupees in Indian wording for amounts a broker types, e.g. 8500000 → "₹85 lakh". */
export function rupeesInWords(n: number) {
  if (n >= 1e7) return `₹${round2(n / 1e7)} crore`
  if (n >= 1e5) return `₹${round2(n / 1e5)} lakh`
  return `₹${n.toLocaleString('en-IN')}`
}

function round2(n: number) {
  return Number(n.toFixed(2)).toString()
}

/** Whole rupees with Indian digit grouping, e.g. 145000 → "₹1,45,000". */
export function inr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}
