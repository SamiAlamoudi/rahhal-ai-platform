/**
 * Phase AI — error taxonomy for production readiness.
 * Maps ops AppError codes into stable production categories.
 */

import { AppError, toAppError, type AppErrorCode } from '../errors/canonicalError'

export type ErrorTaxonomyCategory =
  | 'Validation'
  | 'Authentication'
  | 'Authorization'
  | 'Provider'
  | 'Timeout'
  | 'Internal'

export interface TaxonomyError {
  category: ErrorTaxonomyCategory
  code: AppErrorCode
  message: string
  userMessage: string
  retryable: boolean
  correlationId: string
  status: number
}

const CODE_TO_CATEGORY: Record<AppErrorCode, ErrorTaxonomyCategory> = {
  validation_error: 'Validation',
  auth_error: 'Authentication',
  forbidden: 'Authorization',
  not_found: 'Authorization',
  rate_limited: 'Validation',
  timeout: 'Timeout',
  provider_error: 'Provider',
  provider_unavailable: 'Provider',
  conflict: 'Validation',
  idempotency_conflict: 'Validation',
  config_error: 'Internal',
  internal_error: 'Internal',
}

export function taxonomyCategoryForCode(code: AppErrorCode): ErrorTaxonomyCategory {
  return CODE_TO_CATEGORY[code] ?? 'Internal'
}

export function classifyError(error: unknown, context?: {
  domain?: string
  operation?: string
}): TaxonomyError {
  const appError = toAppError(error, context)
  return {
    category: taxonomyCategoryForCode(appError.code),
    code: appError.code,
    message: appError.message,
    userMessage: appError.userMessage,
    retryable: appError.retryable,
    correlationId: appError.correlationId,
    status: appError.status,
  }
}

export function taxonomyFromAppError(error: AppError): TaxonomyError {
  return {
    category: taxonomyCategoryForCode(error.code),
    code: error.code,
    message: error.message,
    userMessage: error.userMessage,
    retryable: error.retryable,
    correlationId: error.correlationId,
    status: error.status,
  }
}
