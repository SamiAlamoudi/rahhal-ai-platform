import type { NormalizedProviderError, ProviderErrorCode, ProviderFetchStatus } from './types'

/**
 * Normalize adapter/vendor failures into a stable, vendor-agnostic error shape.
 */
export function normalizeProviderError(error: unknown): NormalizedProviderError {
  if (error && typeof error === 'object' && 'code' in error) {
    const row = error as Partial<NormalizedProviderError>
    if (typeof row.code === 'string' && typeof row.message === 'string') {
      return {
        code: row.code as ProviderErrorCode,
        message: row.message,
        retryable: row.retryable ?? isRetryableCode(row.code as ProviderErrorCode),
        rateLimited: row.rateLimited ?? row.code === 'rate_limited',
        retryAfterMs: row.retryAfterMs ?? null,
      }
    }
  }

  const message = error instanceof Error ? error.message : String(error ?? 'provider_error')
  const lower = message.toLowerCase()

  if (lower === 'aborted' || lower.includes('abort')) {
    return {
      code: 'aborted',
      message,
      retryable: false,
      rateLimited: false,
      retryAfterMs: null,
    }
  }
  if (lower.includes('timeout') || lower === 'provider_timeout') {
    return {
      code: 'timeout',
      message,
      retryable: true,
      rateLimited: false,
      retryAfterMs: null,
    }
  }
  if (
    lower.includes('rate') && (lower.includes('limit') || lower.includes('429'))
    || lower.includes('too many requests')
    || lower === 'rate_limited'
  ) {
    const retryAfterMs = parseRetryAfterMs(message) ?? 1_000
    return {
      code: 'rate_limited',
      message,
      retryable: true,
      rateLimited: true,
      retryAfterMs,
    }
  }
  if (lower.includes('not_configured') || lower.includes('not configured')) {
    return {
      code: 'not_configured',
      message,
      retryable: false,
      rateLimited: false,
      retryAfterMs: null,
    }
  }
  if (lower.includes('unsupported')) {
    return {
      code: 'unsupported_domain',
      message,
      retryable: false,
      rateLimited: false,
      retryAfterMs: null,
    }
  }
  if (lower.includes('unavailable') || lower.includes('circuit')) {
    return {
      code: 'unavailable',
      message,
      retryable: true,
      rateLimited: false,
      retryAfterMs: null,
    }
  }

  return {
    code: 'upstream_error',
    message,
    retryable: true,
    rateLimited: false,
    retryAfterMs: null,
  }
}

export function statusFromErrorCode(code: ProviderErrorCode): ProviderFetchStatus {
  if (code === 'timeout') return 'timeout'
  if (code === 'rate_limited') return 'rate_limited'
  if (code === 'unsupported_domain' || code === 'not_configured' || code === 'aborted') {
    return 'skipped'
  }
  return 'error'
}

function isRetryableCode(code: ProviderErrorCode): boolean {
  return code === 'timeout'
    || code === 'rate_limited'
    || code === 'unavailable'
    || code === 'upstream_error'
}

function parseRetryAfterMs(message: string): number | null {
  const match = message.match(/retry[_ ]?after[=:\s]+(\d+)/i)
  if (!match) return null
  const seconds = Number(match[1])
  if (!Number.isFinite(seconds)) return null
  return seconds > 1000 ? seconds : seconds * 1000
}
