/**
 * Phase AE — deterministic retry strategy for booking reservations.
 */

export interface RetryPolicy {
  maxAttempts: number
  baseDelayMs: number
}

export const DEFAULT_BOOKING_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 0, // deterministic / sync unit tests
}

export interface RetryAttemptResult<T> {
  ok: boolean
  value?: T
  attempts: number
  error?: string
}

/**
 * Runs an operation with bounded retries.
 * When baseDelayMs is 0, retries are synchronous (deterministic tests).
 */
export async function withBookingRetry<T>(
  policy: RetryPolicy,
  operation: (attempt: number) => Promise<T> | T,
  shouldRetry: (error: unknown, attempt: number) => boolean = () => true,
): Promise<RetryAttemptResult<T>> {
  let lastError: string | undefined
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      const value = await operation(attempt)
      return { ok: true, value, attempts: attempt }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      const retryable = attempt < policy.maxAttempts && shouldRetry(error, attempt)
      if (!retryable) {
        return { ok: false, attempts: attempt, error: lastError }
      }
      if (policy.baseDelayMs > 0) {
        await new Promise((r) => setTimeout(r, policy.baseDelayMs * attempt))
      }
    }
  }
  return { ok: false, attempts: policy.maxAttempts, error: lastError }
}
