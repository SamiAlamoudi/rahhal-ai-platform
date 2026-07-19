/**
 * Sprint 33 — Execution domain errors.
 */

export type ExecutionErrorCode =
  | 'FEATURE_DISABLED'
  | 'INVALID_ITINERARY'
  | 'VALIDATION_FAILED'
  | 'FLIGHT_RESERVE_FAILED'
  | 'HOTEL_RESERVE_FAILED'
  | 'ROLLBACK_FAILED'
  | 'STATE_TRANSITION_INVALID'
  | 'SESSION_NOT_FOUND'
  | 'RETRY_EXHAUSTED'
  | 'UNKNOWN'

export class ExecutionError extends Error {
  readonly code: ExecutionErrorCode
  readonly retryable: boolean
  readonly details: Record<string, unknown>

  constructor(
    code: ExecutionErrorCode,
    message: string,
    options?: { retryable?: boolean; details?: Record<string, unknown> },
  ) {
    super(message)
    this.name = 'ExecutionError'
    this.code = code
    this.retryable = options?.retryable ?? false
    this.details = options?.details ?? {}
  }
}

export function isExecutionError(error: unknown): error is ExecutionError {
  return error instanceof ExecutionError
}
