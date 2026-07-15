/**
 * Phase AI — centralized retry policy configuration.
 */

export interface RetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  /** When true, honor AbortSignal between attempts. */
  respectAbort?: boolean
}

export interface RetryPolicyConfig {
  provider: RetryPolicy
  booking: RetryPolicy
  planning: RetryPolicy
  notification: RetryPolicy
  default: RetryPolicy
}

export const DEFAULT_RETRY_POLICIES: RetryPolicyConfig = {
  provider: { maxAttempts: 2, baseDelayMs: 40, maxDelayMs: 250, respectAbort: true },
  booking: { maxAttempts: 2, baseDelayMs: 50, maxDelayMs: 400, respectAbort: true },
  planning: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, respectAbort: true },
  notification: { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1_000, respectAbort: true },
  default: { maxAttempts: 2, baseDelayMs: 40, maxDelayMs: 250, respectAbort: true },
}

export type RetryPolicyName = keyof RetryPolicyConfig

export function getRetryPolicy(
  name: RetryPolicyName,
  config: RetryPolicyConfig = DEFAULT_RETRY_POLICIES,
): RetryPolicy {
  return { ...config[name] }
}

export async function withConfiguredRetry<T>(input: {
  policy: RetryPolicy
  signal?: AbortSignal
  shouldRetry?: (error: unknown, attempt: number) => boolean
  run: (attempt: number) => Promise<T>
  onRetry?: (error: unknown, attempt: number) => void
}): Promise<{ value: T; attempts: number }> {
  const maxAttempts = Math.max(1, input.policy.maxAttempts)
  const shouldRetry =
    input.shouldRetry ??
    ((error: unknown) => {
      const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
      return msg.includes('timeout') || msg.includes('unavailable') || msg.includes('429')
    })

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (input.policy.respectAbort !== false && input.signal?.aborted) {
      throw new Error('aborted')
    }
    try {
      const value = await input.run(attempt)
      return { value, attempts: attempt }
    } catch (error) {
      lastError = error
      const canRetry = attempt < maxAttempts && shouldRetry(error, attempt)
      if (!canRetry) break
      input.onRetry?.(error, attempt)
      const delay = Math.min(
        input.policy.maxDelayMs,
        input.policy.baseDelayMs * 2 ** (attempt - 1),
      )
      if (delay > 0) await sleep(delay, input.signal)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'retry_failed'))
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
