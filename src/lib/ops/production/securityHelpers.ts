/**
 * Phase AI — security helpers (sanitize, CORS, headers) re-exported for a single ops surface.
 */

import { sanitizeInput, validateDestination } from '../../security/securityUtils'
import {
  SECURITY_HEADERS,
  buildCorsPolicy,
  assertRequestSize,
  validateNonEmptyString,
  escapeHtml,
  type CorsPolicy,
} from '../security/securityPolicy'

export {
  sanitizeInput,
  validateDestination,
  SECURITY_HEADERS,
  buildCorsPolicy,
  assertRequestSize,
  validateNonEmptyString,
  escapeHtml,
  type CorsPolicy,
}

/** Reject dangerous mass-assignment keys on public API payloads. */
export function rejectSensitivePayloadFields(body: unknown): {
  ok: boolean
  reason?: string
} {
  if (!body || typeof body !== 'object') return { ok: true }
  const keys = Object.keys(body as Record<string, unknown>)
  const blocked = [
    'password',
    'secret',
    'token',
    'apiKey',
    'api_key',
    'cardNumber',
    'cvv',
    'paymentMethod',
    'clientSecret',
  ]
  for (const key of keys) {
    if (blocked.some((b) => key.toLowerCase() === b.toLowerCase())) {
      return { ok: false, reason: `field_not_allowed:${key}` }
    }
  }
  return { ok: true }
}
