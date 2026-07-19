/**
 * Sprint 30 — Hotel provider retry policy (exponential backoff).
 */

export interface HotelRetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
}

export const DEFAULT_HOTEL_RETRY_POLICY: HotelRetryPolicy = {
  maxAttempts: 2,
  baseDelayMs: 40,
  maxDelayMs: 250,
}

export function hotelRetryDelayMs(attempt: number, policy: HotelRetryPolicy): number {
  const exp = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.max(0, attempt - 1))
  return exp
}

export async function withHotelRetry<T>(
  run: (attempt: number) => Promise<T>,
  options: {
    policy?: HotelRetryPolicy
    shouldRetry?: (error: unknown, attempt: number) => boolean
    onRetry?: (attempt: number, error: unknown) => void
    sleep?: (ms: number) => Promise<void>
  } = {},
): Promise<T> {
  const policy = options.policy ?? DEFAULT_HOTEL_RETRY_POLICY
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry
  let lastError: unknown

  for (let attempt = 1; attempt <= policy.maxAttempts + 1; attempt++) {
    try {
      return await run(attempt)
    } catch (error) {
      lastError = error
      if (attempt > policy.maxAttempts || !shouldRetry(error, attempt)) {
        throw error
      }
      options.onRetry?.(attempt, error)
      await sleep(hotelRetryDelayMs(attempt, policy))
    }
  }

  throw lastError
}

function defaultShouldRetry(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true
  const code = (error as { code?: string }).code
  if (code === 'invalid_input' || code === 'not_configured' || code === 'aborted') return false
  return true
}
