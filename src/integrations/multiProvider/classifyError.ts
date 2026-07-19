/**
 * Map provider failures to failover reasons so the chain can decide
 * whether to try the next supplier automatically.
 */

import type { ProviderError } from '../../utils/contracts/result'
import type { FailoverReason } from './types'

const AUTH_CODES = /AUTH|CREDENTIAL|UNAUTHORIZED|401|FORBIDDEN|403|INVALID_CREDENTIAL/i
const QUOTA_CODES = /QUOTA|RATE.?LIMIT|429|THROTTL/i
const TIMEOUT_CODES = /TIMEOUT|ABORT|ETIMEDOUT/i
const UNAVAILABLE_CODES = /UNAVAILABLE|NOT.?CONFIGURED|503|502|NETWORK|ENOTFOUND|EAI_AGAIN/i

export function classifyProviderError(
  error: ProviderError | { code?: string; category?: string; message?: string } | null | undefined,
): FailoverReason {
  if (!error) return 'error'

  const code = error.code ?? ''
  const category = 'category' in error ? String(error.category ?? '') : ''
  const message = error.message ?? ''
  const blob = `${code} ${category} ${message}`

  if (category === 'auth' || AUTH_CODES.test(blob)) return 'authentication'
  if (category === 'rate-limit' || QUOTA_CODES.test(blob)) return 'quota'
  if (category === 'timeout' || TIMEOUT_CODES.test(blob)) return 'timeout'
  if (category === 'network' || UNAVAILABLE_CODES.test(blob)) return 'unavailable'
  return 'error'
}

export function classifyThrown(err: unknown): FailoverReason {
  const message = err instanceof Error ? err.message : String(err ?? '')
  if (TIMEOUT_CODES.test(message)) return 'timeout'
  if (AUTH_CODES.test(message)) return 'authentication'
  if (QUOTA_CODES.test(message)) return 'quota'
  if (UNAVAILABLE_CODES.test(message) || /Failed to fetch|NetworkError/i.test(message)) {
    return 'unavailable'
  }
  return 'error'
}

/** Reasons that always trigger trying the next provider. */
export function shouldFailover(reason: FailoverReason): boolean {
  return (
    reason === 'timeout'
    || reason === 'authentication'
    || reason === 'quota'
    || reason === 'unavailable'
    || reason === 'empty'
    || reason === 'error'
    || reason === 'not_configured'
  )
}
