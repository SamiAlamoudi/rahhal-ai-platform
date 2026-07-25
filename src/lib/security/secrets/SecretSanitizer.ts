/**
 * Sprint 14 — SecretSanitizer (recursive [REDACTED] for logs / traces / errors).
 */

import { REDACTED_PLACEHOLDER } from './types'
import { incrementSanitizationCount } from './metrics'

const SENSITIVE_KEY =
  /^(authorization|cookie|set-cookie|password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|session|credential|client[_-]?secret|token|auth)$/i

const SENSITIVE_VALUE =
  /\b(sk-[A-Za-z0-9_-]{10,}|Bearer\s+[A-Za-z0-9\-._~+/]+=*|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:password|passwd|token|api[_-]?key|access[_-]?token|refresh[_-]?token|secret)\s*[:=]\s*[^\s,;]+)/gi

export class SecretSanitizer {
  sanitize(value: unknown, depth = 0): unknown {
    if (depth > 8) return REDACTED_PLACEHOLDER
    if (value == null) return value
    if (typeof value === 'string') {
      if (SENSITIVE_VALUE.test(value)) {
        incrementSanitizationCount()
        return value.replace(SENSITIVE_VALUE, REDACTED_PLACEHOLDER)
      }
      return value
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (value instanceof Error) {
      incrementSanitizationCount()
      return {
        name: value.name,
        message: String(this.sanitize(value.message, depth + 1)),
        stack: value.stack
          ? String(this.sanitize(value.stack, depth + 1))
          : undefined,
      }
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.sanitize(v, depth + 1))
    }
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_KEY.test(k)) {
          incrementSanitizationCount()
          out[k] = REDACTED_PLACEHOLDER
        } else {
          out[k] = this.sanitize(v, depth + 1)
        }
      }
      return out
    }
    return value
  }

  sanitizeHeaders(headers: Record<string, string | undefined | null>): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(headers)) {
      if (SENSITIVE_KEY.test(k) || /authorization|cookie/i.test(k)) {
        incrementSanitizationCount()
        out[k] = REDACTED_PLACEHOLDER
      } else {
        out[k] = String(this.sanitize(v ?? '') ?? '')
      }
    }
    return out
  }
}

export function createSecretSanitizer(): SecretSanitizer {
  return new SecretSanitizer()
}

export function sanitizeForLogs(value: unknown): unknown {
  return createSecretSanitizer().sanitize(value)
}
