/**
 * Mask PII / secrets before logging. Never log tokens, cards, or provider secrets.
 */

const BLOCKED_KEY = /password|secret|token|authorization|api[_-]?key|client[_-]?secret|passport|card|cvv|pan|iban|bearer|cookie|session/i

export function maskEmail(email: string): string {
  if (!email.includes('@')) return '***'
  const [user, domain] = email.split('@')
  if (!user || !domain) return '***'
  return `${user.slice(0, 1)}***@${domain}`
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '****'
  return `***${digits.slice(-4)}`
}

export function maskSensitiveString(value: string): string {
  if (value.includes('@') && value.includes('.')) return maskEmail(value)
  if (/^\+?\d[\d\s-]{7,}$/.test(value)) return maskPhone(value)
  if (value.length > 24 && /^[A-Za-z0-9._\-+/=]+$/.test(value)) {
    return `${value.slice(0, 4)}…[redacted]`
  }
  return value
}

export function maskMetadata(input: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!input) return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (BLOCKED_KEY.test(key)) {
      out[key] = '[redacted]'
      continue
    }
    if (typeof value === 'string') {
      out[key] = maskSensitiveString(value)
      continue
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = maskMetadata(value as Record<string, unknown>)
      continue
    }
    out[key] = value
  }
  return out
}

export function assertNoSecretsInText(text: string): boolean {
  const patterns = [
    /sk_live_[A-Za-z0-9]+/i,
    /sk_test_[A-Za-z0-9]+/i,
    /AMADEUS_CLIENT_SECRET\s*=\s*\S+/i,
    /OPENWEATHER_API_KEY\s*=\s*\S+/i,
    /GOOGLE_MAPS_API_KEY\s*=\s*\S+/i,
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i,
  ]
  return !patterns.some((p) => p.test(text))
}
