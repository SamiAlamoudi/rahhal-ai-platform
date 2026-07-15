/**
 * Masking helpers — never log raw traveler / payment secrets.
 */

export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null
  const [user, domain] = email.split('@')
  if (!user || !domain) return null
  const visible = user.slice(0, 1)
  return `${visible}***@${domain}`
}

export function maskPassport(passport: string | null | undefined): string | null {
  if (!passport) return null
  const cleaned = passport.replace(/\s+/g, '')
  if (cleaned.length < 4) return '****'
  return `${'*'.repeat(Math.max(0, cleaned.length - 4))}${cleaned.slice(-4)}`
}

export function maskName(firstName: string, lastName: string): string {
  const f = firstName?.trim() || '?'
  const l = lastName?.trim() || '?'
  return `${f.slice(0, 1)}*** ${l.slice(0, 1)}***`
}

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!metadata) return {}
  const blocked = /passport|secret|card|cvv|pan|token|password|authorization/i
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
    out[key] = value
  }
  return out
}

export function stableHash(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}
