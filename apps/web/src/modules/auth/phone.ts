/**
 * Brokers are stored by phone as country code + number with no symbols, e.g. "919876543210".
 * Accepts what people type: "98765 43210", "+91 98765-43210", "09876543210".
 */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) return `91${digits}`
  return digits
}

/**
 * The email a broker's Supabase Auth account is created with. It never receives mail; it only lets the phone number
 * act as the login name. Used by the browser to sign in and by functions/api/auth/register.ts to create the account.
 */
export function brokerEmail(phone: string): string {
  return `${normalizePhone(phone)}@brokers.findhouse.in`
}

/** True for a 10-digit Indian number, with or without +91 or a leading 0. */
export function isIndianMobile(input: string): boolean {
  return /^91\d{10}$/.test(normalizePhone(input))
}
