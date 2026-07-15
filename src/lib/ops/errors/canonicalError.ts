/**
 * Canonical application errors — user-safe messages + internal diagnostics.
 */

import { maskMetadata } from '../logging/mask'
import { getCorrelationId } from '../logging/correlation'

export type AppErrorCode =
  | 'validation_error'
  | 'auth_error'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'timeout'
  | 'provider_error'
  | 'provider_unavailable'
  | 'conflict'
  | 'idempotency_conflict'
  | 'config_error'
  | 'internal_error'

export interface AppErrorOptions {
  code: AppErrorCode
  message: string
  /** Safe for end users (locale-agnostic English fallback). */
  userMessage?: string
  domain?: string
  operation?: string
  status?: number
  retryable?: boolean
  cause?: unknown
  diagnostics?: Record<string, unknown>
}

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly userMessage: string
  readonly domain: string
  readonly operation: string
  readonly status: number
  readonly retryable: boolean
  readonly correlationId: string
  readonly diagnostics: Record<string, unknown>

  constructor(options: AppErrorOptions) {
    super(options.message)
    this.name = 'AppError'
    this.code = options.code
    this.userMessage = options.userMessage ?? userMessageForCode(options.code)
    this.domain = options.domain ?? 'app'
    this.operation = options.operation ?? 'unknown'
    this.status = options.status ?? statusForCode(options.code)
    this.retryable = options.retryable ?? false
    this.correlationId = getCorrelationId()
    this.diagnostics = maskMetadata({
      ...options.diagnostics,
      cause: options.cause instanceof Error ? options.cause.message : undefined,
    })
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      domain: this.domain,
      operation: this.operation,
      status: this.status,
      retryable: this.retryable,
      correlationId: this.correlationId,
      diagnostics: this.diagnostics,
    }
  }
}

export function userMessageForCode(code: AppErrorCode): string {
  switch (code) {
    case 'validation_error':
      return 'Please check your input and try again.'
    case 'auth_error':
      return 'Please sign in to continue.'
    case 'forbidden':
      return 'You do not have access to this resource.'
    case 'not_found':
      return 'The requested resource was not found.'
    case 'rate_limited':
      return 'Too many requests. Please wait and try again.'
    case 'timeout':
      return 'The request timed out. Please try again.'
    case 'provider_error':
    case 'provider_unavailable':
      return 'A travel provider is temporarily unavailable. Showing safest available options.'
    case 'conflict':
    case 'idempotency_conflict':
      return 'This action was already processed.'
    case 'config_error':
      return 'The application is not configured correctly.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

export function statusForCode(code: AppErrorCode): number {
  switch (code) {
    case 'validation_error':
      return 400
    case 'auth_error':
      return 401
    case 'forbidden':
      return 403
    case 'not_found':
      return 404
    case 'conflict':
    case 'idempotency_conflict':
      return 409
    case 'rate_limited':
      return 429
    case 'timeout':
      return 504
    case 'config_error':
      return 503
    default:
      return 500
  }
}

/** Normalize unknown/provider errors into AppError. */
export function toAppError(error: unknown, context?: {
  domain?: string
  operation?: string
}): AppError {
  if (error instanceof AppError) return error

  const message = error instanceof Error ? error.message : String(error ?? 'unknown_error')
  const lower = message.toLowerCase()

  if (lower.includes('timeout') || lower.includes('aborted')) {
    return new AppError({
      code: 'timeout',
      message,
      domain: context?.domain,
      operation: context?.operation,
      retryable: true,
      cause: error,
    })
  }
  if (lower.includes('rate') || lower.includes('429')) {
    return new AppError({
      code: 'rate_limited',
      message,
      domain: context?.domain,
      operation: context?.operation,
      retryable: true,
      cause: error,
    })
  }
  if (lower.includes('circuit') || lower.includes('unavailable') || lower.includes('not_configured')) {
    return new AppError({
      code: 'provider_unavailable',
      message,
      domain: context?.domain,
      operation: context?.operation,
      retryable: true,
      cause: error,
    })
  }
  if (lower.includes('provider') || lower.includes('upstream')) {
    return new AppError({
      code: 'provider_error',
      message,
      domain: context?.domain,
      operation: context?.operation,
      retryable: true,
      cause: error,
    })
  }

  return new AppError({
    code: 'internal_error',
    message,
    domain: context?.domain,
    operation: context?.operation,
    retryable: false,
    cause: error,
  })
}
