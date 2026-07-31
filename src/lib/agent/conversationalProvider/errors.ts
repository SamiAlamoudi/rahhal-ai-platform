/**
 * Sprint 80 P1-3 — Conversational provider error taxonomy + classification.
 */

import type { ConversationalProviderErrorCode, ConversationalProviderId } from './types'

export class ConversationalProviderError extends Error {
  readonly code: ConversationalProviderErrorCode
  readonly providerId: ConversationalProviderId
  readonly retryable: boolean
  readonly statusCode: number | null

  constructor(input: {
    code: ConversationalProviderErrorCode
    message: string
    providerId: ConversationalProviderId
    retryable?: boolean
    statusCode?: number | null
    cause?: unknown
  }) {
    super(input.message, input.cause !== undefined ? { cause: input.cause } : undefined)
    this.name = 'ConversationalProviderError'
    this.code = input.code
    this.providerId = input.providerId
    this.retryable = input.retryable ?? isRetryableConversationalProviderCode(input.code)
    this.statusCode = input.statusCode ?? null
  }
}

export function isRetryableConversationalProviderCode(
  code: ConversationalProviderErrorCode,
): boolean {
  return (
    code === 'TIMEOUT'
    || code === 'NETWORK_FAILURE'
    || code === 'RATE_LIMITED'
    || code === 'SERVER_ERROR'
    || code === 'PROVIDER_UNAVAILABLE'
  )
}

/** Map thrown values / HTTP status into a ConversationalProviderError. */
export function classifyConversationalProviderFailure(
  providerId: ConversationalProviderId,
  err: unknown,
  statusCode?: number | null,
): ConversationalProviderError {
  if (err instanceof ConversationalProviderError) return err

  const message = err instanceof Error ? err.message : String(err ?? 'unknown')
  const lower = message.toLowerCase()

  if (
    message.startsWith('search_blocked_')
    || /invalid.?request|validation|missing.?required/.test(lower)
  ) {
    return new ConversationalProviderError({
      code: 'INVALID_REQUEST',
      message,
      providerId,
      retryable: false,
      cause: err,
    })
  }

  if (statusCode === 429 || /\b429\b|rate.?limit|too many requests/.test(lower)) {
    return new ConversationalProviderError({
      code: 'RATE_LIMITED',
      message,
      providerId,
      statusCode: statusCode ?? 429,
      retryable: true,
      cause: err,
    })
  }

  if (statusCode != null && statusCode >= 500) {
    return new ConversationalProviderError({
      code: 'SERVER_ERROR',
      message,
      providerId,
      statusCode,
      retryable: true,
      cause: err,
    })
  }

  if (
    /timeout|timed?\s*out|aborted|abort.?error/.test(lower)
    || (err instanceof Error && err.name === 'AbortError')
  ) {
    return new ConversationalProviderError({
      code: 'TIMEOUT',
      message,
      providerId,
      retryable: true,
      cause: err,
    })
  }

  if (/network|fetch failed|econnrefused|enotfound|dns/.test(lower)) {
    return new ConversationalProviderError({
      code: 'NETWORK_FAILURE',
      message,
      providerId,
      retryable: true,
      cause: err,
    })
  }

  if (/unavailable|circuit.?open|disabled/.test(lower)) {
    return new ConversationalProviderError({
      code: 'PROVIDER_UNAVAILABLE',
      message,
      providerId,
      retryable: true,
      cause: err,
    })
  }

  return new ConversationalProviderError({
    code: 'UNKNOWN',
    message,
    providerId,
    retryable: false,
    statusCode: statusCode ?? null,
    cause: err,
  })
}

export const GRACEFUL_CONVERSATIONAL_PROVIDER_MESSAGE =
  'تعذر إكمال البحث عبر مزود السفر الآن. نعرض نتائج احتياطية آمنة — يمكنك المحاولة لاحقاً.'
