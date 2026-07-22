/**
 * Sprint 90 — provider error taxonomy for readiness / retry decisions.
 */

export type ProviderErrorCode =
  | 'NETWORK_FAILURE'
  | 'TIMEOUT'
  | 'DNS_FAILURE'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'CIRCUIT_OPEN'
  | 'PROVIDER_UNAVAILABLE'
  | 'SECRETS_MISSING'
  | 'SANDBOX_UNREACHABLE'
  | 'UNKNOWN'

export class ProviderError extends Error {
  readonly code: ProviderErrorCode
  readonly providerId: string
  readonly retryable: boolean
  readonly statusCode: number | null

  constructor(input: {
    code: ProviderErrorCode
    message: string
    providerId: string
    retryable?: boolean
    statusCode?: number | null
    cause?: unknown
  }) {
    super(input.message, input.cause !== undefined ? { cause: input.cause } : undefined)
    this.name = 'ProviderError'
    this.code = input.code
    this.providerId = input.providerId
    this.retryable = input.retryable ?? isRetryableCode(input.code)
    this.statusCode = input.statusCode ?? null
  }
}

export function isRetryableCode(code: ProviderErrorCode): boolean {
  return (
    code === 'NETWORK_FAILURE'
    || code === 'TIMEOUT'
    || code === 'DNS_FAILURE'
    || code === 'RATE_LIMITED'
    || code === 'SERVER_ERROR'
  )
}

/** Map thrown values / HTTP status into a ProviderError. */
export function classifyProviderFailure(
  providerId: string,
  err: unknown,
  statusCode?: number | null,
): ProviderError {
  if (err instanceof ProviderError) return err

  const message = err instanceof Error ? err.message : String(err ?? 'unknown')
  const lower = message.toLowerCase()

  if (statusCode === 429 || /\b429\b|rate.?limit|too many requests/.test(lower)) {
    return new ProviderError({
      code: 'RATE_LIMITED',
      message,
      providerId,
      statusCode: statusCode ?? 429,
      retryable: true,
      cause: err,
    })
  }
  if (statusCode != null && statusCode >= 500) {
    return new ProviderError({
      code: 'SERVER_ERROR',
      message,
      providerId,
      statusCode,
      retryable: true,
      cause: err,
    })
  }
  if (statusCode === 401) {
    return new ProviderError({
      code: 'UNAUTHORIZED',
      message,
      providerId,
      statusCode: 401,
      retryable: false,
      cause: err,
    })
  }
  if (statusCode === 403) {
    return new ProviderError({
      code: 'FORBIDDEN',
      message,
      providerId,
      statusCode: 403,
      retryable: false,
      cause: err,
    })
  }
  if (/timeout|aborted|abort/.test(lower)) {
    return new ProviderError({
      code: 'TIMEOUT',
      message,
      providerId,
      statusCode: statusCode ?? null,
      retryable: true,
      cause: err,
    })
  }
  if (/enotfound|dns|getaddrinfo|eai_again/.test(lower)) {
    return new ProviderError({
      code: 'DNS_FAILURE',
      message,
      providerId,
      statusCode: statusCode ?? null,
      retryable: true,
      cause: err,
    })
  }
  if (/network|fetch failed|econnreset|econnrefused|socket/.test(lower)) {
    return new ProviderError({
      code: 'NETWORK_FAILURE',
      message,
      providerId,
      statusCode: statusCode ?? null,
      retryable: true,
      cause: err,
    })
  }
  if (/circuit/.test(lower)) {
    return new ProviderError({
      code: 'CIRCUIT_OPEN',
      message,
      providerId,
      retryable: false,
      cause: err,
    })
  }

  return new ProviderError({
    code: 'UNKNOWN',
    message,
    providerId,
    statusCode: statusCode ?? null,
    retryable: false,
    cause: err,
  })
}
