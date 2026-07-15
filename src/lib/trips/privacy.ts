/**
 * Masking helpers — never store or return payment secrets / raw PII.
 */

export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null
  const [user, domain] = email.split('@')
  if (!user || !domain) return null
  return `${user.slice(0, 1)}***@${domain}`
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '****'
  return `***${digits.slice(-4)}`
}

export function maskPassport(passport: string | null | undefined): string | null {
  if (!passport) return null
  const cleaned = passport.replace(/\s+/g, '')
  if (cleaned.length < 4) return '****'
  return `${'*'.repeat(Math.max(0, cleaned.length - 4))}${cleaned.slice(-4)}`
}

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!metadata) return {}
  const blocked = /password|secret|token|passport|card|cvv|pan|authorization|api[_-]?key/i
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (blocked.test(key)) {
      out[key] = '[redacted]'
      continue
    }
    if (typeof value === 'string' && value.includes('@')) {
      out[key] = maskEmail(value)
      continue
    }
    if (typeof value === 'string' && /^\+?\d{8,}$/.test(value.replace(/[\s-]/g, ''))) {
      out[key] = maskPhone(value)
      continue
    }
    out[key] = value
  }
  return out
}
