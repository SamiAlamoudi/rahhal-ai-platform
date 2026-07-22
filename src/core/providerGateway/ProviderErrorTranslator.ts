/**
 * Sprint 104 — translate provider failures into traveler-safe GatewayErrorView.
 * Reuses Sprint 90 classifyProviderFailure — no new error taxonomy engines.
 */

import { classifyProviderFailure } from '../providers'
import type { GatewayErrorView } from './types'

export function translateProviderError(
  providerId: string | null,
  err: unknown,
  statusCode?: number | null,
): GatewayErrorView {
  const classified = classifyProviderFailure(providerId ?? 'gateway', err, statusCode)
  return {
    code: classified.code,
    message: classified.message,
    retryable: classified.retryable,
    providerId,
    rateLimited: classified.code === 'RATE_LIMITED',
    timedOut: classified.code === 'TIMEOUT',
  }
}

export function translateOutcomeError(input: {
  providerId: string | null
  error?: string | null
  code?: string | null
  timedOut?: boolean
  circuitOpen?: boolean
}): GatewayErrorView {
  if (input.circuitOpen) {
    return {
      code: 'CIRCUIT_OPEN',
      message: 'Provider circuit is open — temporarily unavailable.',
      retryable: true,
      providerId: input.providerId,
      rateLimited: false,
      timedOut: false,
    }
  }
  if (input.timedOut) {
    return {
      code: 'TIMEOUT',
      message: input.error ?? 'Provider request timed out.',
      retryable: true,
      providerId: input.providerId,
      rateLimited: false,
      timedOut: true,
    }
  }
  const code = (input.code ?? 'UNKNOWN').toUpperCase()
  return {
    code,
    message: input.error ?? 'Provider request failed.',
    retryable: code === 'RATE_LIMITED' || code === 'SERVER_ERROR' || code === 'NETWORK_FAILURE',
    providerId: input.providerId,
    rateLimited: code === 'RATE_LIMITED',
    timedOut: false,
  }
}
